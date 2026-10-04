import * as mock from "./mock.js";
import { mockMapService, withMapFallback, type Coordinate } from "./map-service.js";
import { getCourseWithLessons, getLearningProgress } from "../content-repository.js";
import { getInboxBriefing } from "./email-agent.js";

export interface EmailItem { id?: string; from: string; subject: string; urgency: number; importance?: number; summary: string; requiresResponse?: boolean; suggestedAction?: string }

const configured = (name: string) => Boolean(process.env[name]?.trim());

async function oauthAccessToken(tokenUrl: string, values: Record<string, string>): Promise<string> {
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values),
  });
  if (!response.ok) throw new Error(`OAuth token exchange returned ${response.status}`);
  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new Error("OAuth token exchange did not return an access token");
  return data.access_token;
}

async function gmailAccessToken(): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;
  return oauthAccessToken("https://oauth2.googleapis.com/token", {
    client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token",
  });
}

async function gmailImportantEmails(): Promise<EmailItem[] | null> {
  const accessToken = await gmailAccessToken();
  if (!accessToken) return null;
  const list = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&q=is%3Aunread%20newer_than%3A2d", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!list.ok) throw new Error(`Gmail list returned ${list.status}`);
  const ids = ((await list.json()) as any)?.messages ?? [];
  const messages = await Promise.all(ids.map(async ({ id }: { id: string }) => {
    const result = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!result.ok) throw new Error(`Gmail message returned ${result.status}`);
    return result.json() as Promise<any>;
  }));
  return messages.map((message: any) => {
    const headers = message?.payload?.headers ?? [];
    const header = (name: string) => headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
    const summary = String(message?.snippet ?? "New unread message").slice(0, 240);
    const important = /urgent|presentation|slides?|manager|boss|deadline|changed/i.test(`${header("Subject")} ${summary}`);
    return { from: header("From"), subject: header("Subject") || "Unread email", summary, urgency: important ? 9 : 4 };
  });
}

async function executorImportantEmails(userId: string): Promise<EmailItem[] | null> {
  const url = process.env.EXECUTOR_EMAIL_URL;
  const key = process.env.EXECUTOR_API_KEY;
  if (!url || !key) return null;
  const response = await fetch(url, { headers: { authorization: `Bearer ${key}`, "x-user-id": userId } });
  if (!response.ok) throw new Error(`Executor email returned ${response.status}`);
  const data = await response.json() as any;
  return Array.isArray(data) ? data : data?.emails ?? null;
}

export async function getImportantEmails(userId: string): Promise<EmailItem[]> {
  if (userId === "demo-user") {
    const briefing = await getInboxBriefing(userId, 7);
    return briefing.emails.map((email) => ({ id: email.id, from: email.senderName, subject: email.subject, urgency: email.urgency,
      importance: email.importance, summary: email.shortSummary, requiresResponse: email.requiresResponse, suggestedAction: email.suggestedAction }));
  }
  try {
    return await gmailImportantEmails() ?? await executorImportantEmails(userId) ?? await mock.getImportantEmails(userId);
  } catch (error) {
    console.warn(`[integrations] email provider unavailable; using mock fallback (${(error as Error).message})`);
    return mock.getImportantEmails(userId);
  }
}

export const getCalendarContext = mock.getCalendarContext;
export async function getRouteContext(userId: string, destination?: string) {
  const origin: Coordinate = [-122.2711, 37.8044];
  const end: Coordinate = [-122.3999, 37.7936];
  const route = await withMapFallback(
    (service) => service.directions(origin, end, destination),
    () => mockMapService.directions(origin, end, destination),
  );
  return { ...route, userId };
}
export async function getLectureContext(userId: string) {
  try {
    const course = await getCourseWithLessons("bird-behavior-neuroscience");
    const progress = await getLearningProgress(userId, "bird-behavior-neuroscience");
    const next = course?.lessons.find((lesson) => lesson.id === progress?.currentLessonId) ?? course?.lessons[0];
    if (course && next) return { course: course.title, nextLecture: next.title, transcriptMinutes: next.estimatedDurationMinutes, due: "Friday" };
  } catch (error) {
    console.warn(`[integrations] lecture database unavailable; using metadata fallback (${(error as Error).message})`);
  }
  return mock.getLectureContext(userId);
}

export async function spotifyAccessToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  if (!response.ok) throw new Error(`Spotify token refresh returned ${response.status}`);
  return ((await response.json()) as any)?.access_token ?? null;
}

export async function spotifyPlayback(action: "play" | "pause"): Promise<{ real: boolean; ok: boolean }> {
  const token = await spotifyAccessToken();
  if (!token) return { real: false, ok: true };
  const response = await fetch(`https://api.spotify.com/v1/me/player/${action}`, {
    method: "PUT",
    headers: { authorization: `Bearer ${token}` },
  });
  return { real: true, ok: response.ok || response.status === 204 };
}

export async function createRealtimeClientSecret(userId: string): Promise<any | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "OpenAI-Safety-Identifier": userId },
    body: JSON.stringify({ session: { type: "realtime", model: process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-2.1", instructions: "Act only as the voice interface. Forward planning decisions to the Coordinator API." } }),
  });
  if (!response.ok) throw new Error(`Realtime client secret request returned ${response.status}`);
  return response.json();
}

export function integrationStatus() {
  return {
    database: configured("DATABASE_URL") ? "neon" : "local",
    email: configured("DATABASE_URL") ? "neon_demo" : "local_demo",
    map: configured("MAPBOX_ACCESS_TOKEN") || configured("MAPBOX_PUBLIC_TOKEN") ? "mapbox" : "mock",
    spotify: configured("SPOTIFY_CLIENT_ID") && configured("SPOTIFY_CLIENT_SECRET") && configured("SPOTIFY_REFRESH_TOKEN") ? "spotify" : "mock",
    voice: configured("OPENAI_API_KEY") ? "openai_realtime" : "browser_speech",
    calendar: "mock",
    lecture: configured("DATABASE_URL") ? "neon_seeded" : "local_database",
    presentation: configured("DATABASE_URL") ? "neon_seeded" : "local_database",
  };
}
