import { getDb } from "./db.js";
import { clamp } from "./util.js";
import { randomUUID } from "node:crypto";

/** Confidence grows slowly with observation count: ~0.42 at 7 obs, ~0.91 at 31 obs. */
export const confidenceFor = (n: number) => 1 - Math.exp(-n / 13);

export interface LearnedPref { context_key: string; preference_key: string; value: number; confidence: number; observations: number }

/**
 * Weighted-moving-average update of a context-scoped preference.
 * new = (1 - alpha) * old + alpha * observed. A brand-new row starts at the baseline prior,
 * so a single observation can barely move it.
 */
export async function observe(userId: string, contextKey: string, prefKey: string, observed: number, prior: number, alpha: number) {
  const db = await getDb();
  const [row] = await db.query<LearnedPref>(
    "SELECT * FROM learned_preferences WHERE user_id=$1 AND context_key=$2 AND preference_key=$3", [userId, contextKey, prefKey]);
  if (!row) {
    const v = (1 - alpha) * prior + alpha * observed;
    await db.query(
      "INSERT INTO learned_preferences (id,user_id,context_key,preference_key,value,confidence,observations) VALUES ($1,$2,$3,$4,$5,$6,1)",
      [randomUUID(), userId, contextKey, prefKey, v, confidenceFor(1)]);
    return;
  }
  const n = row.observations + 1;
  await db.query(
    "UPDATE learned_preferences SET value=$1, confidence=$2, observations=$3, last_updated=now() WHERE user_id=$4 AND context_key=$5 AND preference_key=$6",
    [(1 - alpha) * row.value + alpha * observed, confidenceFor(n), n, userId, contextKey, prefKey]);
}

export async function learnedMusicDelta(userId: string, contextKey: string, baselineMusic: number): Promise<number> {
  const db = await getDb();
  const [row] = await db.query<LearnedPref>(
    "SELECT * FROM learned_preferences WHERE user_id=$1 AND context_key=$2 AND preference_key='music_share'", [userId, contextKey]);
  return row ? clamp((row.value - baselineMusic) * row.confidence, -0.3, 0.3) : 0;
}

export async function getLearned(userId: string): Promise<LearnedPref[]> {
  const db = await getDb();
  return db.query<LearnedPref>("SELECT context_key,preference_key,value,confidence,observations,last_updated FROM learned_preferences WHERE user_id=$1 ORDER BY last_updated DESC", [userId]);
}

export function contextKey(o: { period: string; energy: number; durationMin: number; lectureDays: number | null }) {
  const e = o.energy <= 2 ? "low" : o.energy >= 4 ? "high" : "mid";
  const len = o.durationMin >= 60 ? "long" : "short";
  const d = o.lectureDays === null ? "unknown" : o.lectureDays <= 1 ? "due_soon" : o.lectureDays <= 3 ? "mid" : "far";
  return `${o.period}|energy_${e}|${len}_commute|lecture_${d}`;
}
