export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Map free-form activity names onto the canonical keys the planner understands. */
export function normalizeActivity(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (/present|pitch/.test(s)) return "presentation";
  if (/lectur|course|ornith|class\b|study/.test(s)) return "lecture";
  if (/music|spotify|song|playlist|rest|relax/.test(s)) return "music";
  if (/e-?mail|inbox/.test(s)) return "email";
  if (/meeting/.test(s)) return "meeting_prep";
  if (/arrival|recap/.test(s)) return "arrival_summary";
  return s.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "other";
}

/** Does a plan-item type (e.g. presentation_prep) belong to an activity key (e.g. presentation)? */
export function sameActivity(planType: string, activity: string | null | undefined): boolean {
  if (!activity) return false;
  const a = normalizeActivity(activity);
  const t = normalizeActivity(planType);
  return t === a || planType.startsWith(a) || (a === "email" && planType === "email_roundup");
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"];
export function durationPhrase(min: number): string {
  if (min % 60 === 0 && min / 60 < WORDS.length) {
    const h = min / 60;
    return h === 1 ? "an hour" : `${WORDS[h]} hours`;
  }
  if (min === 90) return "an hour and a half";
  return `${min} minutes`;
}

export function periodOfDay(d: Date): "morning" | "afternoon" | "evening" {
  const h = d.getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
/** Days until a deadline given as a weekday name, ISO date, or relative phrase. null if unknown. */
export function daysUntil(due: unknown, now = new Date()): number | null {
  if (typeof due !== "string" || !due) return null;
  const s = due.toLowerCase();
  if (/today|tonight/.test(s)) return 0;
  if (/tomorrow/.test(s)) return 1;
  const idx = DAYS.findIndex((d) => s.includes(d));
  if (idx >= 0) return (idx - now.getDay() + 7) % 7 || 7;
  const t = Date.parse(due);
  if (!Number.isNaN(t)) return Math.max(0, Math.ceil((t - now.getTime()) / 86_400_000));
  return null;
}
