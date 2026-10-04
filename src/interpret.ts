import { Interpretation, noChange } from "./types.js";

const LONG_TERM = /\b(always|from now on|never again|every (time|commute)|in general|permanently)\b/;

/** Deterministic fallback interpreter (also used if the LLM is unavailable or slow). */
export function interpretKeywords(text: string): Interpretation {
  const t = text.toLowerCase();
  const r = noChange();
  const notes: string[] = [];

  const moreMusic = /more music|listen to (some )?music|play (some )?music|want music|music (instead|please)|just music/.test(t);
  const lectureNo = /(no|skip|drop|without|cancel) (the |any )?(more )?lecture|(don'?t|do not) want (the |any )?(more )?lecture/.test(t);
  const lectureLess = /too much lecture|less lecture|shorter lecture|(enough|sick of) (of )?(the )?lecture|lecture is too/.test(t);
  const lowLoad = /(not|n'?t) (to )?(want to )?think|too much (thinking|work|effort)|lighter|something light|relax|zone out|brain.?dead|mentally (drained|tired)/.test(t);
  const tired = /\b(tired|exhausted|sleepy|drained|low energy|wiped)\b/.test(t);
  const awake = /\b(energi[sz]ed|wide awake|full of energy|feeling (great|sharp)|ready to focus)\b/.test(t);
  const continueLearning = /\b(continue|resume|start|play)\b.*\b(bird|lecture|course|lesson)\b/.test(t);
  const productive = /\b(productive|more work|let'?s focus|more lecture|catch up on (the )?lecture)\b/.test(t) || continueLearning;

  if (moreMusic) { r.musicDelta += 0.2; notes.push("more music"); }
  if (lectureNo) { r.lectureFactor = 0; r.drop.push("lecture"); notes.push("drop lecture"); }
  else if (lectureLess || (moreMusic && /lecture/.test(t))) { r.lectureFactor = 0.5; notes.push("less lecture"); }
  if (lowLoad || lectureLess || lectureNo || tired) { r.loadChange = "lower"; r.musicDelta += 0.1; notes.push("lower cognitive load"); }
  if (productive && !lowLoad && !tired) { r.loadChange = "higher"; r.lectureFactor = Math.max(r.lectureFactor, 1.3); notes.push("more productive"); }
  if (tired) r.energyLevel = 2;
  else if (awake) r.energyLevel = 4;

  if (/presentation|pitch|demo\b/.test(t) && /(right after|immediately|when i arrive|after i arrive|as soon as i|once i arrive|today|soon|next)/.test(t)) {
    r.priorityUpdates.push({ activity: "presentation", significance: 10, urgency: 8 });
    notes.push("presentation is critical");
  }
  const lecDue = t.match(/(not due until|due (on )?(next )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)|due (next week|in \d+ days))/);
  if (continueLearning) {
    r.priorityUpdates.push({ activity: "lecture", significance: 9, urgency: 6 });
    r.lectureFactor = Math.max(r.lectureFactor, 1.3);
    notes.push("continue bird course");
  } else if (/lecture|class|course/.test(t) && (lecDue || /not (very )?(important|urgent)|no rush|whenever/.test(t))) {
    r.priorityUpdates.push({ activity: "lecture", significance: 4, urgency: 2 });
    notes.push("lecture is low priority");
  } else if (/lecture|class|course/.test(t) && /due (today|tomorrow|tonight)|exam|quiz/.test(t)) {
    r.priorityUpdates.push({ activity: "lecture", significance: 8, urgency: 7 });
    notes.push("lecture is time-sensitive");
  }

  r.scope = LONG_TERM.test(t) ? "long_term" : "temporary";
  r.summary = notes.length ? notes.join(", ") : "No change requested.";
  return r;
}
