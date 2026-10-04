import "dotenv/config";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getDb } from "../db.js";
import { getLearned } from "../learning.js";
import { getImportantEmails, getCalendarContext, getRouteContext, getLectureContext } from "../integrations/mock.js";
import { Interpretation, noChange } from "../types.js";
import { interpretKeywords } from "../interpret.js";

export const COORDINATOR_INSTRUCTIONS = `You are an adaptive commute coordinator for a voice-first assistant.
Your goal is to allocate the user's remaining commute time. The plan is always editable.
Always consider: remaining duration, user-stated priorities, significance (how important to current goals) vs urgency (needs attention now), energy level, cognitive-load preference, baseline preferences, contextual learned preferences, current activity, deadlines, incoming events, and earlier feedback this commute.
Rules:
1. Replan only the remaining commute, never the completed part.
2. High-urgency events may interrupt; ordinary email must not.
3. Explicit user requests affect THIS commute immediately and are TEMPORARY unless the user says always / from now on / never again.
4. One piece of feedback must not drastically change long-term preferences.
5. Preserve high-significance tasks unless the user explicitly deprioritises them.
6. Respect low energy: lower cognitive load, shorter blocks.
7. Prefer realistic transitions over excessive switching.
8. Spoken replies are short and natural.
Your job in this system is to INTERPRET what the user said into the structured schema. Time arithmetic is done by the deterministic planner; do not compute minutes.`;

const userKey = z.object({ userId: z.string() });
const tools = {
  getUserPreferences: createTool({
    id: "getUserPreferences", description: "Baseline and explicit preferences for the user.",
    inputSchema: userKey,
    execute: async ({ context }) => {
      const db = await getDb();
      return { preferences: await db.query("SELECT key,value,confidence,source FROM preferences WHERE user_id=$1", [context.userId]) };
    },
  }),
  getLearnedPreferences: createTool({
    id: "getLearnedPreferences", description: "Contextual, slowly-learned preferences (value, confidence, observations).",
    inputSchema: userKey,
    execute: async ({ context }) => ({ learned: await getLearned(context.userId) }),
  }),
  getCurrentCommute: createTool({
    id: "getCurrentCommute", description: "Current commute row: remaining time, plan, temporary state.",
    inputSchema: z.object({ commuteId: z.string() }),
    execute: async ({ context }) => {
      const db = await getDb();
      return { commute: (await db.query("SELECT * FROM commutes WHERE id=$1", [context.commuteId]))[0] ?? null };
    },
  }),
  getRecentCommutes: createTool({
    id: "getRecentCommutes", description: "The user's most recent commutes.",
    inputSchema: userKey,
    execute: async ({ context }) => {
      const db = await getDb();
      return { commutes: await db.query("SELECT id,started_at,total_duration_minutes,energy_level,status,initial_plan_json FROM commutes WHERE user_id=$1 ORDER BY started_at DESC LIMIT 5", [context.userId]) };
    },
  }),
  getRecentFeedback: createTool({
    id: "getRecentFeedback", description: "Feedback given during a commute.",
    inputSchema: z.object({ commuteId: z.string() }),
    execute: async ({ context }) => {
      const db = await getDb();
      return { feedback: await db.query("SELECT timestamp,raw_feedback,interpreted_change_json,temporary_or_long_term FROM feedback_events WHERE commute_id=$1 ORDER BY timestamp DESC LIMIT 10", [context.commuteId]) };
    },
  }),
  getImportantEmails: createTool({ id: "getImportantEmails", description: "Recent emails with urgency scores (mocked).", inputSchema: userKey, execute: async ({ context }) => ({ emails: await getImportantEmails(context.userId) }) }),
  getCalendarContext: createTool({ id: "getCalendarContext", description: "Upcoming calendar context (mocked).", inputSchema: userKey, execute: async ({ context }) => getCalendarContext(context.userId) }),
  getRouteContext: createTool({ id: "getRouteContext", description: "Traffic / ETA context (mocked).", inputSchema: userKey, execute: async ({ context }) => getRouteContext(context.userId) }),
  getLectureContext: createTool({ id: "getLectureContext", description: "Lecture content and due date (mocked).", inputSchema: userKey, execute: async ({ context }) => getLectureContext(context.userId) }),
};

let agent: Agent | null = null;
export function getCoordinatorAgent(): Agent {
  agent ??= new Agent({
    name: "commute-coordinator",
    instructions: COORDINATOR_INSTRUCTIONS,
    model: (process.env.COORDINATOR_MODEL ?? "anthropic/claude-haiku-4-5") as any,
    tools,
  });
  return agent;
}

export const llmEnabled = () => !!process.env.ANTHROPIC_API_KEY && process.env.DISABLE_LLM !== "1";

const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("llm timeout")), ms))]);

/** Interpret free text with the Mastra agent; fall back to keywords on any failure. */
export async function interpretUtterance(text: string, ctx: Record<string, unknown>): Promise<{ result: Interpretation; via: "llm" | "keywords" }> {
  if (!text.trim()) return { result: noChange(), via: "keywords" };
  if (llmEnabled()) {
    try {
      const res: any = await withTimeout(
        getCoordinatorAgent().generate(
          `Commute context: ${JSON.stringify(ctx)}\nUser said: "${text}"\nInterpret into the schema. Only set fields the user actually implied.`,
          { output: Interpretation, maxSteps: 3 } as any),
        Number(process.env.LLM_TIMEOUT_MS ?? 8000));
      const parsed = Interpretation.safeParse(res.object);
      if (parsed.success) return { result: parsed.data, via: "llm" };
    } catch (e) {
      console.warn("[agent] falling back to keyword interpreter:", (e as Error).message);
    }
  }
  return { result: interpretKeywords(text), via: "keywords" };
}
