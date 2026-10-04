import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";
import { buildPlan, type BaselinePrefs } from "./planner.js";
import { contextKey, learnedMusicDelta, observe } from "./learning.js";
import { interpretUtterance } from "./mastra/agent.js";
import { getLectureContext } from "./integrations/providers.js";
import { completeLecture, selectLecture } from "./integrations/learning-agent.js";
import { getPresentationPrep } from "./integrations/presentation-agent.js";
import { getInboxBriefing } from "./integrations/email-agent.js";
import { noChange, emptyTemp, type EventIn, type Interpretation, type PlanItem, type Priority, type TempState } from "./types.js";
import { clamp, daysUntil, durationPhrase, normalizeActivity, periodOfDay, sameActivity } from "./util.js";

export class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }

const DEFAULT_PREFS: Record<string, unknown> = {
  music_weight: 0.4, lecture_weight: 0.5, preferred_lecture_block: 25, summary_detail: "concise",
  interruption_threshold: 7, preferred_cognitive_load: "moderate", short_break_after_demanding: true, low_priority_email: "wait",
};

// ---------- preferences ----------
export async function ensureUser(userId: string, name = "User") {
  const db = await getDb();
  await db.query("INSERT INTO users (id,name) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING", [userId, name]);
  for (const [k, v] of Object.entries(DEFAULT_PREFS)) {
    await db.query(
      "INSERT INTO preferences (id,user_id,key,value,confidence,source) VALUES ($1,$2,$3,$4::jsonb,1,'baseline') ON CONFLICT (user_id,key) DO NOTHING",
      [randomUUID(), userId, k, JSON.stringify(v)]);
  }
}

async function loadPrefs(userId: string) {
  const db = await getDb();
  const rows = await db.query<{ key: string; value: any }>("SELECT key,value FROM preferences WHERE user_id=$1", [userId]);
  const p: Record<string, any> = { ...DEFAULT_PREFS };
  for (const r of rows) p[r.key] = r.value;
  const baseline: BaselinePrefs = {
    musicShare: Number(p.music_weight), lectureBlock: Number(p.preferred_lecture_block),
    breakAfterDemanding: !!p.short_break_after_demanding,
  };
  return { baseline, threshold: Number(p.interruption_threshold), raw: p };
}

/** Explicit "always / from now on" statements nudge the stored preference (explicit source = high trust), but never wholesale. */
async function applyLongTerm(userId: string, i: Interpretation, baseline: BaselinePrefs) {
  const db = await getDb();
  const set = async (key: string, value: unknown) =>
    db.query(
      `INSERT INTO preferences (id,user_id,key,value,confidence,source) VALUES ($1,$2,$3,$4::jsonb,0.9,'explicit')
       ON CONFLICT (user_id,key) DO UPDATE SET value=$4::jsonb, confidence=0.9, source='explicit', updated_at=now()`,
      [randomUUID(), userId, key, JSON.stringify(value)]);
  if (i.musicDelta !== 0) await set("music_weight", Number(clamp(baseline.musicShare + Math.sign(i.musicDelta) * 0.1, 0.1, 0.8).toFixed(2)));
  if (i.lectureFactor < 1) await set("lecture_weight", Number(clamp(0.5 - 0.1, 0.1, 1).toFixed(2)));
}

// ---------- helpers ----------
const num = (x: unknown, d: number) => (typeof x === "number" && Number.isFinite(x) ? x : d);
function parseEnergy(e: unknown): number | null {
  if (typeof e === "number") return clamp(Math.round(e), 1, 5);
  if (e === "low") return 2;
  if (e === "medium") return 3;
  if (e === "high") return 4;
  return null;
}
const sumMinutes = (plan: PlanItem[], pred: (p: PlanItem) => boolean) => plan.filter(pred).reduce((s, p) => s + p.minutes, 0);
const prettyName = (type: string) => ({ presentation_prep: "presentation prep", lecture: "lecture", meeting_prep: "meeting prep" } as Record<string, string>)[type] ?? type.replace(/_/g, " ");

async function attachAgentContent(plan: PlanItem[], userId: string): Promise<PlanItem[]> {
  const enriched = plan.map((item) => ({ ...item }));
  const used: string[] = [];
  for (let index = 0; index < enriched.length; index++) {
    const item = enriched[index];
    if (item.type !== "lecture") continue;
    const lesson = await selectLecture(userId, item.minutes, used);
    if (!lesson) continue;
    used.push(lesson.id);
    const unusedMinutes = Math.max(0, item.minutes - lesson.estimatedDurationMinutes);
    Object.assign(item, {
      minutes: lesson.estimatedDurationMinutes,
      label: lesson.title,
      lessonId: lesson.id,
      courseTitle: "Introduction to Bird Behavior and Neuroscience",
      topic: lesson.topic,
      difficulty: lesson.difficulty,
      shortDescription: lesson.shortDescription,
      fullLectureScript: lesson.fullLectureScript,
    });
    if (unusedMinutes > 0) {
      const music = enriched.slice(index + 1).find((candidate) => candidate.type === "music")
        ?? enriched.slice(0, index).reverse().find((candidate) => candidate.type === "music");
      if (music) music.minutes += unusedMinutes;
      else enriched.splice(index + 1, 0, { type: "music", minutes: unusedMinutes, significance: 7, urgency: 2, label: "Music" });
    }
  }
  const presentation = await getPresentationPrep(userId);
  const presentationItem = enriched.find((item) => item.type === "presentation_prep" || item.type === "presentation_practice");
  if (presentation && presentationItem) Object.assign(presentationItem, {
    presentationId: presentation.id,
    presentationTitle: presentation.title,
    fullPresentationPrepScript: presentation.fullPrepScript,
  });
  for (const emailItem of enriched.filter((item) => item.type === "email_roundup")) {
    const briefing = await getInboxBriefing(userId, emailItem.minutes);
    emailItem.emailIds = briefing.emails.map((email) => email.id);
    emailItem.emailSummaryScript = briefing.spokenSummary;
  }
  return enriched;
}

function applyInterpretation(i: Interpretation, st: { temp: TempState; priorities: Record<string, Priority>; energy: number }) {
  const t = st.temp;
  t.musicBias = clamp(t.musicBias + i.musicDelta, -0.4, 0.5);
  t.lectureFactor = clamp(t.lectureFactor * i.lectureFactor, 0, 1.5);
  if (i.loadChange === "lower") t.loadTarget = Math.min(t.loadTarget ?? 5, 2);
  if (i.loadChange === "higher") t.loadTarget = Math.min(5, (t.loadTarget ?? st.energy) + 1);
  for (const d of i.drop) { const k = normalizeActivity(d); if (!t.dropped.includes(k)) t.dropped.push(k); }
  if (i.energyLevel) st.energy = i.energyLevel;
  for (const u of i.priorityUpdates) {
    const k = normalizeActivity(u.activity);
    const cur = st.priorities[k] ?? { significance: 5, urgency: 2 };
    st.priorities[k] = { significance: u.significance ?? cur.significance, urgency: u.urgency ?? cur.urgency };
  }
}

type Level = "critical" | "high" | "notable" | "low";
function classify(e: EventIn, threshold: number): { level: Level; interrupt: boolean } {
  if (e.urgency >= 9) return { level: "critical", interrupt: true };
  if (e.urgency >= threshold) return { level: "high", interrupt: true };
  if (e.urgency >= threshold - 3) return { level: "notable", interrupt: false };
  return { level: "low", interrupt: false };
}

// ---------- initial plan ----------
export async function createPlan(req: import("zod").infer<typeof import("./types.js").PlanRequest>) {
  await ensureUser(req.userId);
  const db = await getDb();
  const { baseline } = await loadPrefs(req.userId);
  const lecture = await getLectureContext(req.userId);
  const now = new Date();

  const priorities: Record<string, Priority> = {};
  for (const p of req.priorities) priorities[normalizeActivity(p.activity)] = { significance: p.significance, urgency: p.urgency };
  const ctx = req.context ?? {};
  if (ctx.presentationAfterArrival && !priorities.presentation) priorities.presentation = { significance: 10, urgency: 8 };
  const lectureDays = daysUntil(ctx.lectureDue ?? lecture.due, now);
  if (!priorities.lecture) {
    const d = daysUntil(ctx.lectureDue, now);
    priorities.lecture = d === null ? { significance: 5, urgency: 3 }
      : { significance: d <= 1 ? 8 : d <= 3 ? 6 : 4, urgency: d <= 1 ? 7 : d <= 3 ? 4 : 2 };
  }
  priorities.music ??= { significance: 8, urgency: 2 };

  const st = { temp: emptyTemp(), priorities, energy: parseEnergy(req.energyLevel) ?? 3 };
  const heard: string[] = [];
  for (const u of req.utterances) {
    const { result } = await interpretUtterance(u, { stage: "pre-commute", durationMin: req.commuteDurationMinutes });
    applyInterpretation(result, st); heard.push(result.summary);
  }

  const ckey = contextKey({ period: periodOfDay(now), energy: st.energy, durationMin: req.commuteDurationMinutes, lectureDays });
  const learned = await learnedMusicDelta(req.userId, ckey, baseline.musicShare);
  const plan = await attachAgentContent(buildPlan({
    remainingMinutes: req.commuteDurationMinutes, priorities: st.priorities, energyLevel: st.energy, prefs: baseline,
    learnedMusicDelta: learned, temp: st.temp, startWith: "auto", includeEmailRoundup: true,
    labels: { lecture: "Bird behavior lesson", email_roundup: "Email roundup" },
  }), req.userId);

  const commuteId = randomUUID();
  await db.query(
    `INSERT INTO commutes (id,user_id,destination,total_duration_minutes,remaining_minutes,energy_level,current_activity,current_plan_json,initial_plan_json,priorities_json,temp_state_json,context_json,context_key)
     VALUES ($1,$2,$3,$4,$4,$5,$6,$7::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11)`,
    [commuteId, req.userId, req.destination, req.commuteDurationMinutes, st.energy, plan[0]?.type ?? null,
     JSON.stringify(plan), JSON.stringify(st.priorities), JSON.stringify(st.temp), JSON.stringify(ctx), ckey]);
  await writeActivities(commuteId, plan, 0);

  const spoken = initialSpeech(req.commuteDurationMinutes, plan, st.priorities, st.energy);
  return {
    commuteId, spokenResponse: spoken,
    reason: heard.length ? `Heard: ${heard.join("; ")}.` : "Initial plan from stated priorities, energy and preferences.",
    interruptCurrentActivity: false,
    currentAction: plan[0] ? { type: plan[0].type, durationMinutes: plan[0].minutes } : null,
    plan, updatedPlan: plan, totalMinutes: req.commuteDurationMinutes,
    state: { energyLevel: st.energy, priorities: st.priorities, contextKey: ckey, learnedMusicAdjustment: Number(learned.toFixed(3)) },
  };
}

function initialSpeech(total: number, plan: PlanItem[], pri: Record<string, Priority>, energy: number): string {
  const top = Object.entries(pri).filter(([k, p]) => k !== "music" && p.significance >= 8 && plan.some((b) => sameActivity(b.type, k)))
    .sort((a, b) => b[1].significance - a[1].significance)[0];
  const tired = energy <= 2;
  const why = [top ? `your ${top[0].replace(/_/g, " ")} is important` : "", tired ? "you're feeling tired" : ""].filter(Boolean).join(" and ");
  const lec = sumMinutes(plan, (p) => p.type === "lecture");
  const breaks = plan.filter((p) => p.type === "music").length;
  const bits = [
    top ? `prioritize ${prettyName(top[0] === "presentation" ? "presentation_prep" : top[0])}` : "build a balanced mix",
    lec === 0 ? "skip the lecture" : lec <= 20 && top ? "keep the lecture short" : "fit in your lecture",
    breaks ? `give you ${breaks === 1 ? "a music break" : `${breaks === 2 ? "two" : breaks} music breaks`}` : "",
  ].filter(Boolean);
  const list = bits.length > 1 ? `${bits.slice(0, -1).join(", ")}, and ${bits[bits.length - 1]}` : bits[0];
  return `You have ${durationPhrase(total)}. ${why ? `Since ${why}, ` : ""}I'll ${list}. Does that sound good?`;
}

async function writeActivities(commuteId: string, plan: PlanItem[], offset: number) {
  const db = await getDb();
  await db.query("DELETE FROM activities WHERE commute_id=$1 AND status='planned'", [commuteId]);
  for (const [i, p] of plan.entries()) {
    await db.query(
      "INSERT INTO activities (id,commute_id,type,planned_minutes,significance,urgency,status,order_index) VALUES ($1,$2,$3,$4,$5,$6,'planned',$7)",
      [randomUUID(), commuteId, p.type, p.minutes, p.significance, p.urgency, offset + i]);
  }
}

// ---------- replan (feedback + events) ----------
interface ReplanArgs { userId?: string; commuteId: string; remainingMinutes?: number; currentActivity?: string | null; userFeedback?: string; newEvents?: EventIn[]; }

export async function replan(a: ReplanArgs) {
  const db = await getDb();
  const [c] = await db.query<any>("SELECT * FROM commutes WHERE id=$1", [a.commuteId]);
  if (!c) throw new HttpError(404, `commute ${a.commuteId} not found`);
  if (a.userId && a.userId !== c.user_id) throw new HttpError(403, "commute belongs to another user");
  if (c.status === "completed") throw new HttpError(409, "commute already completed");

  const { baseline, threshold } = await loadPrefs(c.user_id);
  const remaining = Math.round(a.remainingMinutes ?? c.remaining_minutes);
  const current: string | null = a.currentActivity ?? c.current_activity ?? null;
  const prevPlan: PlanItem[] = c.current_plan_json ?? [];
  const st = {
    temp: { ...emptyTemp(), ...(c.temp_state_json ?? {}) } as TempState,
    priorities: (c.priorities_json ?? {}) as Record<string, Priority>,
    energy: (c.energy_level ?? 3) as number,
  };

  // 1. interpret explicit feedback (temporary by default)
  let interp: Interpretation = noChange();
  let via = "none";
  const fb = a.userFeedback?.trim();
  const continueCourseRequested = !!fb && /\b(continue|resume|start|play)\b.*\b(bird|lecture|course|lesson)\b/i.test(fb);
  if (fb) {
    const r = await interpretUtterance(fb, { remainingMinutes: remaining, currentActivity: current, energy: st.energy, priorities: st.priorities, temp: st.temp });
    interp = r.result; via = r.via;
    applyInterpretation(interp, st);
    if (continueCourseRequested) {
      const lecturePriority = st.priorities.lecture ?? { significance: 5, urgency: 2 };
      st.priorities.lecture = { significance: Math.max(9, lecturePriority.significance), urgency: Math.max(6, lecturePriority.urgency) };
      st.temp.lectureFactor = Math.max(1.3, st.temp.lectureFactor);
      st.temp.dropped = st.temp.dropped.filter((activity) => normalizeActivity(activity) !== "lecture");
    }
    await db.query(
      "INSERT INTO feedback_events (id,commute_id,raw_feedback,interpreted_change_json,activity_type,temporary_or_long_term) VALUES ($1,$2,$3,$4::jsonb,$5,$6)",
      [randomUUID(), c.id, fb, JSON.stringify(interp), current, interp.scope === "long_term" ? "long_term" : "temporary"]);
    if (interp.scope === "long_term") await applyLongTerm(c.user_id, interp, baseline);
  }

  // 2. incoming events: urgency (needs attention now) vs significance (matters to goals)
  let urgentEvent: { summary: string; urgency: number; significance: number } | null = null;
  const notes: string[] = [];
  for (const e of a.newEvents ?? []) {
    const { level, interrupt } = classify(e, threshold);
    await db.query(
      "INSERT INTO incoming_events (id,commute_id,type,source,summary,urgency,significance,handled,disposition) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [randomUUID(), c.id, e.type, e.source ?? null, e.summary, e.urgency, e.significance, interrupt, level]);
    if (/presentation|slides?|deck|pitch|demo\b/i.test(e.summary) && level !== "low") {
      const cur = st.priorities.presentation ?? { significance: 5, urgency: 2 };
      st.priorities.presentation = { significance: Math.max(cur.significance, e.significance, 9), urgency: Math.max(cur.urgency, e.urgency) };
      st.temp.invalidated = { ...st.temp.invalidated, presentation: 0.5 }; // new info: half of earlier prep is stale
    }
    if (interrupt && (!urgentEvent || e.urgency > urgentEvent.urgency)) urgentEvent = { summary: e.summary, urgency: e.urgency, significance: e.significance };
    else if (level === "notable") st.temp.pendingEvents.push(e.summary);
    notes.push(`${level}: ${e.summary}`);
  }

  // 3. decide how to start the remaining plan
  const currentPri = current ? st.priorities[normalizeActivity(current)] : undefined;
  const softensCurrent = !!current && (interp.lectureFactor < 1 || interp.loadChange === "lower" || interp.drop.length > 0)
    && (currentPri?.significance ?? 5) < 8 && normalizeActivity(current) !== "music";
  const startWith = urgentEvent ? "event" : continueCourseRequested ? "lecture" : softensCurrent && (interp.musicDelta > 0 || interp.loadChange === "lower") ? "music" : "current";

  const ckey: string = c.context_key;
  const doneRows = await db.query<{ type: string; actual_minutes: number }>("SELECT type,actual_minutes FROM activities WHERE commute_id=$1 AND status='done'", [c.id]);
  const completed: Record<string, number> = {};
  for (const d of doneRows) { const k = normalizeActivity(d.type); completed[k] = (completed[k] ?? 0) + d.actual_minutes; }
  const plan = await attachAgentContent(buildPlan({
    remainingMinutes: remaining, priorities: st.priorities, energyLevel: st.energy, prefs: baseline,
    learnedMusicDelta: await learnedMusicDelta(c.user_id, ckey, baseline.musicShare),
    temp: st.temp, completed, currentActivity: current, startWith, includeEmailRoundup: false, urgentEvent,
    labels: { lecture: "Bird behavior lesson" },
  }), c.user_id);
  const first = plan[0] ?? null;
  const interrupt = !!first && !!current && !sameActivity(first.type, current) && (startWith !== "current");

  // 4. persist plan + temp state (temporary preferences live on the commute, not in preferences)
  const [{ n }] = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM activities WHERE commute_id=$1 AND status='done'", [c.id]);
  await writeActivities(c.id, plan, n);
  await db.query(
    "UPDATE commutes SET remaining_minutes=$1, current_activity=$2, current_plan_json=$3::jsonb, priorities_json=$4::jsonb, temp_state_json=$5::jsonb, energy_level=$6 WHERE id=$7",
    [remaining, first?.type ?? current, JSON.stringify(plan), JSON.stringify(st.priorities), JSON.stringify(st.temp), st.energy, c.id]);

  // 5. long-term learning: a single in-commute feedback is a very small observation (alpha 0.04)
  if (fb && remaining > 0) {
    const total = remaining || 1;
    await observe(c.user_id, ckey, "music_share", sumMinutes(plan, (p) => p.type === "music") / total, baseline.musicShare, 0.04);
    await observe(c.user_id, ckey, "lecture_share", sumMinutes(plan, (p) => p.type === "lecture") / total, 0.25, 0.04);
  }

  const spoken = urgentEvent
    ? eventSpeech(urgentEvent.summary, current, plan, interrupt)
    : replanSpeech(!!fb, prevPlan, plan, st.priorities, interp);
  return {
    commuteId: c.id, spokenResponse: spoken,
    reason: [fb ? `${interp.summary}${interp.scope === "long_term" ? " (saved as an explicit long-term preference)" : " (temporary, this commute only)"}` : "", ...notes].filter(Boolean).join(" | ") || "Replanned remaining time.",
    interruptCurrentActivity: interrupt,
    currentAction: first ? { type: first.type, durationMinutes: first.minutes } : null,
    updatedPlan: plan, plan, remainingMinutes: remaining,
    temporaryState: st.temp, interpretedVia: via,
    urgentEvent: urgentEvent ? { ...urgentEvent, askForSummary: true } : null,
  };
}

function replanSpeech(hasFeedback: boolean, prev: PlanItem[], next: PlanItem[], pri: Record<string, Priority>, i: Interpretation): string {
  const frac = (plan: PlanItem[], type: string) => { const t = sumMinutes(plan, () => true) || 1; return sumMinutes(plan, (p) => p.type === type) / t; };
  const lec0 = sumMinutes(prev, (p) => p.type === "lecture"), lec1 = sumMinutes(next, (p) => p.type === "lecture");
  const parts: string[] = [];
  if (lec1 === 0 && lec0 > 0) parts.push("wrap up the lecture");
  else if (frac(next, "lecture") < frac(prev, "lecture") - 0.02) parts.push("shorten the lecture");
  else if (frac(next, "lecture") > frac(prev, "lecture") + 0.02) parts.push("make room for more lecture");
  if (frac(next, "music") > frac(prev, "music") + 0.02) parts.push("give you more music");
  else if (frac(next, "music") < frac(prev, "music") - 0.02) parts.push("trim the music");
  const top = Object.entries(pri).filter(([k, p]) => k !== "music" && p.significance >= 8 && next.some((b) => sameActivity(b.type, k)))
    .sort((a, b) => b[1].significance - a[1].significance)[0];
  const keep = top && (hasFeedback && (i.lectureFactor < 1 || i.loadChange === "lower" || i.musicDelta > 0))
    ? ` I'll keep your ${prettyName(next.find((b) => sameActivity(b.type, top[0]))!.type)} since it matters most.` : "";
  if (!hasFeedback) return "Okay, I've refreshed the plan for the time you have left.";
  return parts.length ? `Got it. I'll ${parts.length > 1 ? `${parts[0]} and ${parts[1]}` : parts[0]}.${keep}` : `Got it. I'll keep things roughly as planned.${keep}`;
}

function eventSpeech(summary: string, current: string | null, plan: PlanItem[], interrupt: boolean): string {
  const pause = current && interrupt ? `I'll pause the ${prettyName(normalizeActivity(current) === "presentation" ? "presentation_prep" : current)} for a moment. ` : "";
  const next = plan.find((p) => p.type === "presentation_prep");
  return `Heads up, urgent: ${summary.replace(/\.$/, "")}. ${pause}Want a quick summary?${next ? " I've moved presentation prep up next." : ""}`;
}

// ---------- incoming event path ----------
export async function handleEvent(r: import("zod").infer<typeof import("./types.js").EventRequest>) {
  const db = await getDb();
  const [c] = await db.query<any>("SELECT * FROM commutes WHERE id=$1", [r.commuteId]);
  if (!c) throw new HttpError(404, `commute ${r.commuteId} not found`);
  const { threshold } = await loadPrefs(c.user_id);
  const ev: EventIn = { type: r.type, source: r.source, summary: r.summary, urgency: r.urgency, significance: r.significance };
  const { level, interrupt } = classify(ev, threshold);

  if (interrupt) {
    const out = await replan({ commuteId: r.commuteId, remainingMinutes: r.remainingMinutes, currentActivity: r.currentActivity, newEvents: [ev] });
    return { ...out, level, interrupt: true, askForSummary: true };
  }
  // below threshold: record, never interrupt
  await db.query(
    "INSERT INTO incoming_events (id,commute_id,type,source,summary,urgency,significance,handled,disposition) VALUES ($1,$2,$3,$4,$5,$6,$7,false,$8)",
    [randomUUID(), c.id, ev.type, ev.source ?? null, ev.summary, ev.urgency, ev.significance, level]);
  if (level === "notable") {
    const t = { ...emptyTemp(), ...(c.temp_state_json ?? {}) } as TempState;
    t.pendingEvents.push(ev.summary);
    await db.query("UPDATE commutes SET temp_state_json=$1::jsonb WHERE id=$2", [JSON.stringify(t), c.id]);
  }
  const plan: PlanItem[] = c.current_plan_json ?? [];
  return {
    commuteId: c.id, level, interrupt: false, askForSummary: false, interruptCurrentActivity: false,
    spokenResponse: level === "notable" ? `FYI: ${ev.summary.replace(/\.$/, "")}. I'll mention it at the next break.` : "",
    reason: `Urgency ${ev.urgency} is below the interruption threshold of ${threshold}; held for later.`,
    currentAction: plan[0] ? { type: plan[0].type, durationMinutes: plan[0].minutes } : null,
    updatedPlan: plan, plan,
  };
}

// ---------- activity results + completion (long-term learning from actual behaviour) ----------
export async function saveActivityResult(commuteId: string, type: string, actualMinutes: number) {
  const db = await getDb();
  const rows = await db.query<any>("SELECT id FROM activities WHERE commute_id=$1 AND type=$2 AND status='planned' ORDER BY order_index LIMIT 1", [commuteId, type]);
  if (rows[0]) await db.query("UPDATE activities SET actual_minutes=$1, status='done' WHERE id=$2", [actualMinutes, rows[0].id]);
  else await db.query(
    "INSERT INTO activities (id,commute_id,type,planned_minutes,actual_minutes,status,order_index) VALUES ($1,$2,$3,0,$4,'done',(SELECT COALESCE(MAX(order_index),0)+1 FROM activities WHERE commute_id=$5))",
    [randomUUID(), commuteId, type, actualMinutes, commuteId]);
  let learningProgress;
  if (normalizeActivity(type) === "lecture") {
    const [commute] = await db.query<any>("SELECT user_id,current_plan_json FROM commutes WHERE id=$1", [commuteId]);
    const lesson = (commute?.current_plan_json as PlanItem[] | undefined)?.find((item) => item.type === "lecture" && item.lessonId);
    if (lesson?.lessonId && actualMinutes >= Math.max(1, lesson.minutes * 0.75)) learningProgress = await completeLecture(commute.user_id, lesson.lessonId);
  }
  return { ok: true, learningProgress };
}

export async function completeCommute(commuteId: string) {
  const db = await getDb();
  const [c] = await db.query<any>("SELECT * FROM commutes WHERE id=$1", [commuteId]);
  if (!c) throw new HttpError(404, `commute ${commuteId} not found`);
  if (c.status === "completed") return { ok: true, alreadyCompleted: true };
  const done = await db.query<{ type: string; actual_minutes: number }>("SELECT type,actual_minutes FROM activities WHERE commute_id=$1 AND status='done'", [commuteId]);
  const total = done.reduce((s, d) => s + d.actual_minutes, 0);
  if (total > 0) {
    const { baseline } = await loadPrefs(c.user_id);
    const share = (t: string) => done.filter((d) => d.type === t).reduce((s, d) => s + d.actual_minutes, 0) / total;
    await observe(c.user_id, c.context_key, "music_share", share("music"), baseline.musicShare, 0.1);
    await observe(c.user_id, c.context_key, "lecture_share", share("lecture"), 0.25, 0.1);
  }
  await db.query("UPDATE commutes SET status='completed', remaining_minutes=0 WHERE id=$1", [commuteId]);
  return { ok: true, observedMinutes: total };
}

export async function getCommute(commuteId: string) {
  const db = await getDb();
  const [c] = await db.query<any>("SELECT * FROM commutes WHERE id=$1", [commuteId]);
  if (!c) throw new HttpError(404, `commute ${commuteId} not found`);
  const [activities, feedback, events] = await Promise.all([
    db.query("SELECT * FROM activities WHERE commute_id=$1 ORDER BY order_index", [commuteId]),
    db.query("SELECT * FROM feedback_events WHERE commute_id=$1 ORDER BY timestamp", [commuteId]),
    db.query("SELECT * FROM incoming_events WHERE commute_id=$1 ORDER BY created_at", [commuteId]),
  ]);
  return { commute: c, activities, feedback, events };
}
