import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { ZodError, z } from "zod";
import { getDb } from "./db.js";
import { PlanRequest, ReplanRequest, EventRequest } from "./types.js";
import { HttpError, createPlan, replan, handleEvent, saveActivityResult, completeCommute, getCommute, ensureUser } from "./coordinator.js";
import { getLearned } from "./learning.js";
import { llmEnabled } from "./mastra/agent.js";

export const app = new Hono();
app.use("*", cors());

app.onError((err, c) => {
  if (err instanceof ZodError) return c.json({ error: "invalid_request", details: err.issues }, 400);
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status as 400);
  if (err instanceof SyntaxError) return c.json({ error: "invalid_json" }, 400);
  console.error(err);
  return c.json({ error: "internal_error", message: (err as Error).message }, 500);
});

app.get("/health", async (c) => c.json({ ok: true, db: (await getDb()).kind, llm: llmEnabled() }));
app.post("/api/plan", async (c) => c.json(await createPlan(PlanRequest.parse(await c.req.json()))));
app.post("/api/replan", async (c) => c.json(await replan(ReplanRequest.parse(await c.req.json()))));
app.post("/api/event", async (c) => c.json(await handleEvent(EventRequest.parse(await c.req.json()))));
app.post("/api/activity-result", async (c) => {
  const b = z.object({ commuteId: z.string(), type: z.string(), actualMinutes: z.number().min(0) }).parse(await c.req.json());
  return c.json(await saveActivityResult(b.commuteId, b.type, b.actualMinutes));
});
app.post("/api/complete", async (c) => c.json(await completeCommute(z.object({ commuteId: z.string() }).parse(await c.req.json()).commuteId)));
app.get("/api/commute/:id", async (c) => c.json(await getCommute(c.req.param("id"))));
app.get("/api/users/:id/learned", async (c) => c.json({ learned: await getLearned(c.req.param("id")) }));
app.get("/api/users/:id/preferences", async (c) => {
  const db = await getDb();
  return c.json({ preferences: await db.query("SELECT key,value,confidence,source,updated_at FROM preferences WHERE user_id=$1 ORDER BY key", [c.req.param("id")]) });
});

if (process.argv[1]?.endsWith("server.ts")) {
  const port = Number(process.env.PORT ?? 8787);
  const db = await getDb();
  await ensureUser("demo-user", "Demo User");
  serve({ fetch: app.fetch, port });
  console.log(`Commute Copilot coordinator on :${port}  (db=${db.kind}, llm=${llmEnabled() ? "on" : "off → keyword fallback"})`);
}
