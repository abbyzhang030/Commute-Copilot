import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { ZodError, z } from "zod";
import { getDb } from "./db.js";
import { PlanRequest, ReplanRequest, EventRequest } from "./types.js";
import { HttpError, createPlan, replan, handleEvent, saveActivityResult, completeCommute, getCommute, ensureUser } from "./coordinator.js";
import { getLearned } from "./learning.js";
import { llmEnabled } from "./mastra/agent.js";
import { configuredModelProvider } from "./mastra/agent.js";
import { createRealtimeClientSecret, getImportantEmails, integrationStatus, spotifyPlayback } from "./integrations/providers.js";
import { getMapService, mapboxPublicToken, mockMapService, withMapFallback, type Coordinate } from "./integrations/map-service.js";
import { getCourseCatalog, getLearnerProgress, selectLecture } from "./integrations/learning-agent.js";
import { getPresentationPrep } from "./integrations/presentation-agent.js";
import { listCourses } from "./content-repository.js";
import { getInboxBriefing, readEmail } from "./integrations/email-agent.js";

export const app = new Hono();
app.use("*", cors());

app.onError((err, c) => {
  if (err instanceof ZodError) return c.json({ error: "invalid_request", details: err.issues }, 400);
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status as 400);
  if (err instanceof SyntaxError) return c.json({ error: "invalid_json" }, 400);
  console.error(err);
  return c.json({ error: "internal_error", message: (err as Error).message }, 500);
});

app.get("/health", async (c) => c.json({ ok: true, db: (await getDb()).kind, llm: llmEnabled(), modelProvider: configuredModelProvider(), integrations: integrationStatus() }));
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
app.get("/api/integrations/status", (c) => c.json({ integrations: integrationStatus(), modelProvider: configuredModelProvider() }));
app.get("/api/learning/courses", async (c) => c.json({ courses: await listCourses() }));
app.get("/api/learning/course", async (c) => c.json(await getCourseCatalog()));
app.get("/api/learning/progress/:userId", async (c) => c.json(await getLearnerProgress(c.req.param("userId"))));
app.get("/api/learning/lesson", async (c) => {
  const userId = z.string().min(1).default("demo-user").parse(c.req.query("userId"));
  const availableMinutes = z.coerce.number().int().min(1).max(120).parse(c.req.query("availableMinutes"));
  return c.json({ lesson: await selectLecture(userId, availableMinutes) });
});
app.get("/api/presentation/upcoming/:userId", async (c) => c.json({ presentation: await getPresentationPrep(c.req.param("userId")) }));
app.get("/api/email/important", async (c) => c.json({ emails: await getImportantEmails(c.req.query("userId") ?? "demo-user") }));
app.get("/api/email/summary", async (c) => {
  const userId = c.req.query("userId") ?? "demo-user";
  const availableMinutes = z.coerce.number().int().min(1).max(30).default(5).parse(c.req.query("availableMinutes"));
  return c.json(await getInboxBriefing(userId, availableMinutes));
});
app.get("/api/email/message/:id", async (c) => c.json({ result: await readEmail(c.req.query("userId") ?? "demo-user", c.req.param("id")) }));
app.post("/api/media/:action", async (c) => {
  const action = z.enum(["play", "pause"]).parse(c.req.param("action"));
  return c.json(await spotifyPlayback(action));
});
app.get("/api/music/config", (c) => {
  const playlistId = process.env.YOUTUBE_PLAYLIST_ID?.trim();
  c.header("Cache-Control", "no-store");
  return c.json({ provider: playlistId ? "youtube" : "mock", playlistId: playlistId || null });
});
const coordinate = z.tuple([z.coerce.number().min(-180).max(180), z.coerce.number().min(-90).max(90)]);
const coordinateQuery = (value: string | undefined, fallback: Coordinate): Coordinate => {
  if (!value) return fallback;
  return coordinate.parse(value.split(","));
};
app.get("/api/map/config", (c) => {
  const token = mapboxPublicToken();
  return c.json({ provider: token ? "mapbox" : "mock", publicToken: token });
});
app.get("/api/map/search", async (c) => {
  const query = z.string().min(2).max(256).parse(c.req.query("q"));
  const sessionToken = z.string().uuid().parse(c.req.query("sessionToken"));
  const proximity = coordinateQuery(c.req.query("proximity"), [-122.2711, 37.8044]);
  const suggestions = await withMapFallback(
    (service) => service.suggest(query, sessionToken, proximity),
    () => mockMapService.suggest(query, sessionToken, proximity),
  );
  return c.json({ suggestions });
});
app.get("/api/map/retrieve/:id", async (c) => {
  const id = z.string().min(1).max(512).parse(c.req.param("id"));
  const sessionToken = z.string().uuid().parse(c.req.query("sessionToken"));
  const destination = await withMapFallback(
    (service) => service.retrieve(id, sessionToken),
    () => mockMapService.retrieve(id, sessionToken),
  );
  return c.json(destination);
});
app.get("/api/map/directions", async (c) => {
  const origin = coordinateQuery(c.req.query("origin"), [-122.2711, 37.8044]);
  const destination = coordinateQuery(c.req.query("destination"), [-122.3999, 37.7936]);
  const destinationName = z.string().max(180).default("Work").parse(c.req.query("destinationName"));
  const route = await withMapFallback(
    (service) => service.directions(origin, destination, destinationName),
    () => mockMapService.directions(origin, destination, destinationName),
  );
  return c.json(route);
});
app.post("/api/voice/session", async (c) => {
  const body = z.object({ userId: z.string().min(1).default("demo-user") }).parse(await c.req.json().catch(() => ({})));
  const session = await createRealtimeClientSecret(body.userId);
  if (!session) return c.json({ error: "realtime_not_configured" }, 503);
  c.header("Cache-Control", "no-store");
  return c.json(session);
});

// Serve the existing frontend from the same origin as the Coordinator API.
// This keeps local development credential-free and lets the browser use the
// relative /api/* URLs already built into the driving interface.
app.use("/*", serveStatic({ root: "./dist" }));

if (process.argv[1]?.endsWith("server.ts")) {
  const port = Number(process.env.PORT ?? 8787);
  const db = await getDb();
  await ensureUser("demo-user", "Demo User");
  serve({ fetch: app.fetch, port });
  console.log(`Commute Copilot on http://localhost:${port}  (db=${db.kind}, intent=${llmEnabled() ? "model" : "local keywords"})`);
}
