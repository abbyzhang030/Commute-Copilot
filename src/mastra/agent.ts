import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { getDb } from "../db.js";
import { getLearned } from "../learning.js";
import { getImportantEmails, getCalendarContext, getRouteContext, getLectureContext } from "../integrations/providers.js";
import { Interpretation, noChange } from "../types.js";
import { interpretKeywords } from "../interpret.js";

export const COORDINATOR_INSTRUCTIONS = `You are the Coordinator of an adaptive, voice-first commute assistant. You decide what the driver's remaining commute time should be spent on.
Always weigh: remaining time, stated priorities, significance (importance to goals) vs urgency (needs attention now), energy, cognitive-load preference, baseline and learned preferences, current activity, deadlines, incoming events, and earlier feedback.
Rules: the plan is always editable; only the remaining commute is replanned; explicit requests change THIS commute immediately and are TEMPORARY unless the driver says always / from now on / never again; one comment must not rewrite long-term preferences; keep high-significance work unless the driver explicitly deprioritises it; respect low energy.
Your task in this system: INTERPRET what the driver said (a free-form answer or feedback, sometimes with the question that was asked) into JSON. Minutes are allocated by a deterministic planner, so never compute minutes.
Return JSON only. Only set changes the driver actually requested or clearly implied.
The required JSON shape is:
{"musicDelta":number(-0.4..0.5, +0.2 = noticeably more music),"lectureFactor":number(0..2, 1=unchanged, 0.5=halve, 0=drop),"loadChange":"lower"|"same"|"higher","energyLevel":number(1 exhausted..5 energised)|null,"priorityUpdates":[{"activity":string,"significance":number(0..10)|null,"urgency":number(0..10)|null}],"drop":string[],"scope":"temporary"|"long_term","summary":string}
Examples of priorityUpdates: a presentation right after arrival = {"activity":"presentation","significance":10,"urgency":8}; a lecture not due for days = {"activity":"lecture","significance":4,"urgency":2}.`;

const userKey = z.object({ userId: z.string() });
// Read-only context tools. Writes (feedback, plans, results) stay in deterministic code for reliability.
const tools = {
  getUserPreferences: createTool({ id: "getUserPreferences", description: "Baseline and explicit preferences.", inputSchema: userKey,
    execute: async ({ context }) => ({ preferences: await (await getDb()).query("SELECT key,value,confidence,source FROM preferences WHERE user_id=$1", [context.userId]) }) }),
  getLearnedPreferences: createTool({ id: "getLearnedPreferences", description: "Contextual learned preferences with confidence and observation counts.", inputSchema: userKey,
    execute: async ({ context }) => ({ learned: await getLearned(context.userId) }) }),
  getCurrentCommute: createTool({ id: "getCurrentCommute", description: "Current commute row.", inputSchema: z.object({ commuteId: z.string() }),
    execute: async ({ context }) => ({ commute: (await (await getDb()).query("SELECT * FROM commutes WHERE id=$1", [context.commuteId]))[0] ?? null }) }),
  getRecentCommutes: createTool({ id: "getRecentCommutes", description: "Recent commutes.", inputSchema: userKey,
    execute: async ({ context }) => ({ commutes: await (await getDb()).query("SELECT id,started_at,total_duration_minutes,energy_level,status FROM commutes WHERE user_id=$1 ORDER BY started_at DESC LIMIT 5", [context.userId]) }) }),
  getRecentFeedback: createTool({ id: "getRecentFeedback", description: "Feedback given during a commute.", inputSchema: z.object({ commuteId: z.string() }),
    execute: async ({ context }) => ({ feedback: await (await getDb()).query("SELECT timestamp,raw_feedback,interpreted_change_json,temporary_or_long_term FROM feedback_events WHERE commute_id=$1 ORDER BY timestamp DESC LIMIT 10", [context.commuteId]) }) }),
  getImportantEmails: createTool({ id: "getImportantEmails", description: "Recent emails with urgency.", inputSchema: userKey, execute: async ({ context }) => ({ emails: await getImportantEmails(context.userId) }) }),
  getCalendarContext: createTool({ id: "getCalendarContext", description: "Upcoming calendar context.", inputSchema: userKey, execute: async ({ context }) => getCalendarContext(context.userId) }),
  getRouteContext: createTool({ id: "getRouteContext", description: "Traffic / ETA context.", inputSchema: userKey, execute: async ({ context }) => getRouteContext(context.userId) }),
  getLectureContext: createTool({ id: "getLectureContext", description: "Lecture content and due date.", inputSchema: userKey, execute: async ({ context }) => getLectureContext(context.userId) }),
};

/** Model routing for Mastra: Neon AI Gateway (OpenAI-compatible, Neon credits) first, then a direct Anthropic key. */
function mastraModel(): any {
  const token = process.env.NEON_AI_GATEWAY_TOKEN;
  const base = process.env.NEON_AI_GATEWAY_BASE_URL?.replace(/\/+$/, "");
  if (token && base) {
    return { id: `neon/${process.env.COORDINATOR_MODEL ?? "claude-haiku-4-5"}`, url: base.endsWith("/v1") ? base : `${base}/v1`, apiKey: token };
  }
  return `anthropic/${process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5"}`;
}

let agent: Agent | null = null;
export function getCoordinatorAgent(): Agent {
  agent ??= new Agent({
    name: "commute-coordinator",
    instructions: COORDINATOR_INSTRUCTIONS,
    model: mastraModel(),
    // Tool calling isn't documented for the gateway's chat endpoint, so tools are opt-in (AGENT_TOOLS=1).
    ...(process.env.AGENT_TOOLS === "1" ? { tools } : {}),
  });
  return agent;
}

async function mastraInterpret(text: string, context: Record<string, unknown>): Promise<Interpretation | null> {
  const res: any = await getCoordinatorAgent().generate(
    `Commute context: ${JSON.stringify(context)}\nDriver said: ${JSON.stringify(text)}\nReturn the JSON.`,
    { maxSteps: process.env.AGENT_TOOLS === "1" ? 3 : 1 } as any);
  return parseInterpretation(res?.text ?? "");
}

type Provider = "neon_gateway" | "anthropic" | "keywords";

const stripFence = (text: string) => text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

function parseInterpretation(text: string): Interpretation | null {
  try {
    const cleaned = stripFence(text);
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    const raw = JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
    const candidate = raw?.interpretation ?? raw?.result ?? raw;
    const base = noChange();
    const value = candidate && typeof candidate === "object" ? candidate : {};
    const number = (input: unknown, fallback: number, min: number, max: number) => {
      const n = typeof input === "number" ? input : Number(input);
      return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
    };
    const parsed = Interpretation.safeParse({
      musicDelta: number(value.musicDelta, base.musicDelta, -0.4, 0.5),
      lectureFactor: number(value.lectureFactor, base.lectureFactor, 0, 2),
      loadChange: ["lower", "same", "higher"].includes(value.loadChange) ? value.loadChange : base.loadChange,
      energyLevel: value.energyLevel == null ? null : number(value.energyLevel, 3, 1, 5),
      priorityUpdates: Array.isArray(value.priorityUpdates) ? value.priorityUpdates.map((item: any) => ({
        activity: String(item?.activity ?? ""),
        significance: item?.significance == null ? null : number(item.significance, 5, 0, 10),
        urgency: item?.urgency == null ? null : number(item.urgency, 2, 0, 10),
      })).filter((item: any) => item.activity) : [],
      drop: Array.isArray(value.drop) ? value.drop.map(String) : [],
      scope: value.scope === "long_term" ? "long_term" : "temporary",
      summary: typeof value.summary === "string" ? value.summary : base.summary,
    });
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function neonGateway(text: string, context: Record<string, unknown>): Promise<Interpretation | null> {
  const token = process.env.NEON_AI_GATEWAY_TOKEN;
  const base = process.env.NEON_AI_GATEWAY_BASE_URL?.replace(/\/+$/, "");
  if (!token || !base) return null;
  const endpoint = base.endsWith("/v1") ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.COORDINATOR_MODEL ?? "claude-haiku-4-5",
      max_tokens: 500,
      messages: [
        { role: "system", content: COORDINATOR_INSTRUCTIONS },
        { role: "user", content: `Commute context: ${JSON.stringify(context)}\nDriver said: ${JSON.stringify(text)}` },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Neon AI Gateway returned ${response.status}`);
  const data = await response.json() as any;
  const content = data?.choices?.[0]?.message?.content;
  const parsed = parseInterpretation(Array.isArray(content) ? content.map((part: any) => part?.text ?? "").join("") : content ?? "");
  if (!parsed) console.warn("[coordinator] Neon AI Gateway response did not match the interpretation schema; using local intent fallback");
  return parsed;
}

async function anthropic(text: string, context: Record<string, unknown>): Promise<Interpretation | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: COORDINATOR_INSTRUCTIONS,
      messages: [{ role: "user", content: `Commute context: ${JSON.stringify(context)}\nDriver said: ${JSON.stringify(text)}` }],
    }),
  });
  if (!response.ok) throw new Error(`Anthropic returned ${response.status}`);
  const data = await response.json() as any;
  return parseInterpretation(data?.content?.find((part: any) => part?.type === "text")?.text ?? "");
}

export function configuredModelProvider(): Provider {
  if (process.env.DISABLE_LLM === "1") return "keywords";
  if (process.env.NEON_AI_GATEWAY_TOKEN && process.env.NEON_AI_GATEWAY_BASE_URL) return "neon_gateway";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return "keywords";
}

export const llmEnabled = () => configuredModelProvider() !== "keywords";

export type Engine = "mastra" | "fetch" | "keywords";

/**
 * Interpret free text. Order: Mastra agent -> direct HTTP call to the same provider -> keyword rules.
 * Each stage is time-boxed; a failure is logged (never silent) and falls through to the next.
 */
export async function interpretUtterance(
  text: string,
  context: Record<string, unknown>,
  keywordText = text,
): Promise<{ result: Interpretation; via: "llm" | "keywords"; engine: Engine }> {
  if (!text.trim()) return { result: noChange(), via: "keywords", engine: "keywords" };
  const provider = configuredModelProvider();
  if (provider !== "keywords") {
    const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 12000);
    const attempt = <T,>(request: Promise<T | null>): Promise<T | null> =>
      Promise.race([request, new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))]);
    const stages: [Engine, () => Promise<Interpretation | null>][] = [
      ["mastra", () => mastraInterpret(text, context)],
      ["fetch", () => (provider === "neon_gateway" ? neonGateway(text, context) : anthropic(text, context))],
    ];
    for (const [engine, run] of stages) {
      try {
        const out = await attempt(run());
        if (out) return { result: out, via: "llm", engine };
        console.warn(`[coordinator] ${engine} (${provider}) returned nothing usable; trying next stage`);
      } catch (error) {
        console.warn(`[coordinator] ${engine} (${provider}) failed: ${(error as Error).message}`);
      }
    }
  }
  return { result: interpretKeywords(keywordText), via: "keywords", engine: "keywords" };
}
