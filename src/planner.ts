import type { PlanItem, Priority, TempState } from "./types.js";
import { clamp, sameActivity } from "./util.js";

export interface BaselinePrefs {
  musicShare: number; // 0..1 typical fraction of commute
  lectureBlock: number; // preferred lecture block (min)
  breakAfterDemanding: boolean;
}

export interface PlannerInput {
  remainingMinutes: number;
  priorities: Record<string, Priority>; // keyed by canonical activity (presentation, lecture, ...)
  energyLevel: number; // 1..5
  prefs: BaselinePrefs;
  learnedMusicDelta: number; // confidence-weighted contextual nudge
  temp: TempState;
  currentActivity?: string | null;
  startWith: "auto" | "current" | "music" | "event";
  includeEmailRoundup: boolean;
  urgentEvent?: { summary: string; urgency: number; significance: number } | null;
  completed?: Record<string, number>; // minutes already spent per canonical activity this commute
  labels?: Record<string, string>;
}

// Reference minutes at significance 10 / urgency 0, and cognitive weight, per task.
const REF: Record<string, number> = { presentation: 35, lecture: 60, meeting_prep: 30 };
const COG: Record<string, number> = { presentation: 0.8, lecture: 1, meeting_prep: 0.8 };
const LOAD_FACTOR = [0, 0.45, 0.6, 0.85, 1, 1.1];
const NON_TASKS = new Set(["music", "email", "arrival_summary", "event_summary"]);

interface Task { key: string; sig: number; urg: number; want: number; protected: boolean; }

const split = (minutes: number, maxBlock: number): number[] => {
  const n = Math.max(1, Math.ceil(minutes / maxBlock));
  const base = Math.floor(minutes / n);
  const out = Array<number>(n).fill(base);
  for (let i = 0; i < minutes - base * n; i++) out[i]++;
  return out;
};

export function buildPlan(inp: PlannerInput): PlanItem[] {
  const R = Math.max(0, Math.floor(inp.remainingMinutes));
  if (R === 0) return [];
  const label = (k: string, d: string) => inp.labels?.[k] ?? d;

  const arrival = R < 3 ? R : R < 10 ? 3 : 5;
  const email = inp.includeEmailRoundup && R >= 30 ? 10 : 0;
  const eventMin = inp.urgentEvent && R >= arrival + 6 ? 3 : 0;
  const P = Math.max(0, R - arrival - email - eventMin);

  const load = LOAD_FACTOR[clamp(Math.round(Math.min(inp.energyLevel, inp.temp.loadTarget ?? 5)), 1, 5)];
  const lectureCap = inp.energyLevel <= 2 || (inp.temp.loadTarget ?? 5) <= 2 ? 20 : inp.prefs.lectureBlock;

  // 1. Desired minutes per task from significance, urgency and cognitive-load fit.
  const tasks: Task[] = Object.entries(inp.priorities)
    .filter(([k]) => !NON_TASKS.has(k) && !inp.temp.dropped.includes(k))
    .map(([key, p]) => {
      const prot = p.significance >= 8;
      const f = prot ? Math.max(load, 0.85) : load; // high-significance work is only lightly softened
      let want = (REF[key] ?? 25) * (p.significance / 10) * (1 + p.urgency / 20) * (1 - (COG[key] ?? 0.6) * (1 - f));
      if (key === "lecture") want *= inp.temp.lectureFactor;
      // credit work already done (minus any that was invalidated by new information)
      want -= (inp.completed?.[key] ?? 0) * (1 - (inp.temp.invalidated?.[key] ?? 0));
      want = Math.max(0, want);
      return { key, sig: p.significance, urg: p.urgency, want: want < 6 ? 0 : want, protected: prot };
    })
    .filter((t) => t.want > 0)
    .sort((a, b) => b.sig * (1 + b.urg / 10) - a.sig * (1 + a.urg / 10));

  // 2. Music share: baseline + learned context + temporary bias + energy.
  const energyAdj = inp.energyLevel <= 2 ? 0.1 : inp.energyLevel >= 4 ? -0.05 : 0;
  const m = clamp(inp.prefs.musicShare + inp.learnedMusicDelta + inp.temp.musicBias + energyAdj, 0.1, 0.85);
  const hardFloor = 0.2 * P;
  const softFloor = Math.max(hardFloor, (m - 0.25) * P);

  // 3. Allocate: protected tasks first, then other tasks, music is the sink above its floor.
  const prot = tasks.filter((t) => t.protected);
  const rest = tasks.filter((t) => !t.protected);
  const Wp = prot.reduce((s, t) => s + t.want, 0);
  const pScale = Wp > P - hardFloor && Wp > 0 ? Math.max(0, P - hardFloor) / Wp : 1;
  const alloc = new Map<string, number>();
  prot.forEach((t) => alloc.set(t.key, t.want * pScale));
  const remain = P - Wp * pScale;
  const Wo = rest.reduce((s, t) => s + t.want, 0);
  const otherBudget = Wo === 0 ? 0 : Math.min(Wo, Math.max(remain - softFloor, Math.min(Wo * 0.5, remain * 0.3)));
  rest.forEach((t) => alloc.set(t.key, (t.want / Wo) * otherBudget));
  // drop slivers: not worth a context switch
  for (const [k, v] of alloc) if (Math.round(v) < 6) alloc.set(k, 0);
  const taskTotal = [...alloc.values()].reduce((s, v) => s + Math.round(v), 0);
  const musicMin = Math.max(0, P - taskTotal);

  // 4. Turn allocations into blocks.
  const sigOf = (k: string) => inp.priorities[k]?.significance ?? 5;
  const urgOf = (k: string) => inp.priorities[k]?.urgency ?? 2;
  const demanding: PlanItem[] = [];
  let practice: PlanItem | null = null;
  for (const t of tasks) {
    const mins = Math.round(alloc.get(t.key) ?? 0);
    if (mins <= 0) continue;
    if (t.key === "presentation") {
      const prepDone = (inp.completed?.presentation ?? 0) * (1 - (inp.temp.invalidated?.presentation ?? 0)) >= 20;
      const pr = prepDone ? mins : mins >= 25 ? Math.min(15, Math.round(mins * 0.3)) : 0;
      if (pr) practice = { type: "presentation_practice", minutes: pr, significance: t.sig, urgency: t.urg, label: label("presentation_practice", "Presentation practice") };
      split(mins - pr, inp.energyLevel <= 2 ? 30 : 40).forEach((x) =>
        demanding.push({ type: "presentation_prep", minutes: x, significance: t.sig, urgency: t.urg, label: label("presentation_prep", "Presentation preparation") }));
    } else {
      const cap = t.key === "lecture" ? lectureCap : 30;
      split(mins, cap).forEach((x) =>
        demanding.push({ type: t.key, minutes: x, significance: t.sig, urgency: t.urg, label: label(t.key, t.key.replace(/_/g, " ")) }));
    }
  }
  if (practice) demanding.push(practice);

  const music = (x: number): PlanItem => ({ type: "music", minutes: x, significance: sigOf("music") || 7, urgency: 2, label: label("music", "Music") });
  const seq: PlanItem[] = [];
  if (!demanding.length) {
    if (musicMin > 0) seq.push(music(musicMin));
  } else {
    // music breaks between demanding blocks; the final block runs straight into arrival
    const gaps = Math.max(1, demanding.length - 1);
    const chunks = musicMin > 0 ? split(musicMin, Math.ceil(musicMin / gaps)).slice(0, gaps) : [];
    const extra = musicMin - chunks.reduce((s, x) => s + x, 0);
    if (chunks.length && extra > 0) chunks[chunks.length - 1] += extra;
    demanding.forEach((b, i) => {
      seq.push(b);
      if (i < demanding.length - 1 || demanding.length === 1) if (chunks[i] !== undefined) seq.push(music(chunks[i]));
    });
  }

  // 5. Start-of-plan ordering (avoid needless switching: keep current activity first when still planned).
  const moveFirst = (pred: (p: PlanItem) => boolean) => {
    const i = seq.findIndex(pred);
    if (i > 0) seq.unshift(...seq.splice(i, 1));
  };
  if (inp.startWith === "music") moveFirst((p) => p.type === "music");
  else if (inp.startWith === "current" && inp.currentActivity) moveFirst((p) => sameActivity(p.type, inp.currentActivity));
  else if (inp.startWith === "event") {
    // after the alert, resume presentation work first if the event touched it
    moveFirst((p) => p.type === "presentation_prep");
  }

  const out: PlanItem[] = [];
  if (inp.startWith === "event" && eventMin) {
    out.push({ type: "event_summary", minutes: eventMin, significance: inp.urgentEvent!.significance, urgency: inp.urgentEvent!.urgency, label: "Urgent update summary" });
  }
  if (email) out.push({ type: "email_roundup", minutes: email, significance: 5, urgency: 4, label: label("email_roundup", "Email roundup") });
  out.push(...seq);
  if (arrival) out.push({ type: "arrival_summary", minutes: arrival, significance: 8, urgency: 5, label: "Arrival recap" });
  if (inp.startWith !== "event" && eventMin) {
    // event was not interrupting; its minutes were reserved above, give them back to music
    const mu = out.find((p) => p.type === "music");
    if (mu) mu.minutes += eventMin; else out.splice(out.length - 1, 0, music(eventMin));
  }

  return fit(out, R);
}

/** Guarantee: integer minutes, no empty blocks, total exactly equals the remaining time. */
function fit(items: PlanItem[], R: number): PlanItem[] {
  let out = items.filter((i) => i.minutes > 0);
  const sum = () => out.reduce((s, i) => s + i.minutes, 0);
  let diff = R - sum();
  if (diff > 0) {
    const sink = [...out].reverse().find((i) => i.type === "music") ?? out.filter((i) => i.type !== "arrival_summary").pop() ?? out[out.length - 1];
    if (sink) sink.minutes += diff; else out = [{ type: "music", minutes: R, significance: 7, urgency: 2 }];
  }
  while (diff < 0 && out.length) {
    const big = out.reduce((a, b) => (b.minutes > a.minutes ? b : a));
    const cut = Math.min(-diff, big.minutes - 1 || big.minutes);
    big.minutes -= cut; diff += cut;
    out = out.filter((i) => i.minutes > 0);
  }
  // merge adjacent identical blocks
  return out.reduce<PlanItem[]>((acc, i) => {
    const last = acc[acc.length - 1];
    if (last && last.type === i.type) last.minutes += i.minutes; else acc.push({ ...i });
    return acc;
  }, []);
}
