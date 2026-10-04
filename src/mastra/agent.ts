import { Interpretation, noChange } from "../types.js";
import { interpretKeywords } from "../interpret.js";

export const COORDINATOR_INSTRUCTIONS = `You interpret voice feedback for an adaptive commute coordinator.
Return JSON only. Only set changes the driver actually requested. Changes are temporary unless the driver explicitly says always, from now on, or never again.
If the driver asks to continue, resume, or play their bird course, increase lecture priority and lectureFactor; do not generate lesson content.
The required JSON shape is:
{"musicDelta":number,"lectureFactor":number,"loadChange":"lower"|"same"|"higher","energyLevel":number|null,"priorityUpdates":[{"activity":string,"significance":number|null,"urgency":number|null}],"drop":string[],"scope":"temporary"|"long_term","summary":string}`;

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

export async function interpretUtterance(
  text: string,
  context: Record<string, unknown>,
): Promise<{ result: Interpretation; via: "llm" | "keywords" }> {
  if (!text.trim()) return { result: noChange(), via: "keywords" };
  const provider = configuredModelProvider();
  if (provider !== "keywords") {
    try {
      const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? 8000);
      const attempt = async (request: Promise<Interpretation | null>) => Promise.race([
        request, new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
      ]);
      const primary = await attempt(provider === "neon_gateway" ? neonGateway(text, context) : anthropic(text, context));
      if (primary) return { result: primary, via: "llm" };
      if (provider === "neon_gateway" && process.env.ANTHROPIC_API_KEY) {
        const secondary = await attempt(anthropic(text, context));
        if (secondary) return { result: secondary, via: "llm" };
      }
    } catch (error) {
      console.warn(`[coordinator] ${provider} unavailable; using local intent fallback (${(error as Error).message})`);
    }
  }
  return { result: interpretKeywords(text), via: "keywords" };
}
