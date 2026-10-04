import { z } from "zod";

export interface PlanItem {
  type: string;
  minutes: number;
  significance: number;
  urgency: number;
  label?: string;
}

export interface Priority {
  significance: number;
  urgency: number;
}

/** Commute-scoped, temporary state. Never written to long-term preferences directly. */
export interface TempState {
  musicBias: number; // additive shift to music share, -0.4..0.5
  lectureFactor: number; // multiplier on lecture time, 0..1.5
  loadTarget: number | null; // 1..5 cap on cognitive load (null = follow energy)
  dropped: string[];
  priorityOverrides: Record<string, Partial<Priority>>;
  pendingEvents: string[]; // notable-but-not-interrupting events to flag at next transition
  invalidated: Record<string, number>; // fraction of already-done work that must be redone (e.g. slides changed)
}

export const emptyTemp = (): TempState => ({
  musicBias: 0,
  lectureFactor: 1,
  loadTarget: null,
  dropped: [],
  priorityOverrides: {},
  pendingEvents: [],
  invalidated: {},
});

export const Interpretation = z.object({
  musicDelta: z.number().min(-0.4).max(0.5).describe("Shift in desired music share for THIS commute. +0.2 = noticeably more music."),
  lectureFactor: z.number().min(0).max(2).describe("Multiplier for lecture time. 1 = unchanged, 0.5 = halve, 0 = drop."),
  loadChange: z.enum(["lower", "same", "higher"]).describe("Requested change to cognitive load."),
  energyLevel: z.number().int().min(1).max(5).nullable().describe("Stated energy 1 (exhausted) to 5 (energised); null if not mentioned."),
  priorityUpdates: z.array(z.object({
    activity: z.string(),
    significance: z.number().min(0).max(10).nullable(),
    urgency: z.number().min(0).max(10).nullable(),
  })).describe("Priorities the user stated (e.g. presentation right after arrival = significance 10, urgency 8)."),
  drop: z.array(z.string()).describe("Activities the user explicitly wants removed for this commute."),
  scope: z.enum(["temporary", "long_term"]).describe("long_term ONLY if the user says always / from now on / never again."),
  summary: z.string().describe("One short sentence describing the interpreted change."),
});
export type Interpretation = z.infer<typeof Interpretation>;

export const noChange = (): Interpretation => ({
  musicDelta: 0, lectureFactor: 1, loadChange: "same", energyLevel: null,
  priorityUpdates: [], drop: [], scope: "temporary", summary: "No change requested.",
});

const energyInput = z.union([z.number().min(1).max(5), z.enum(["low", "medium", "high"])]);

export const PlanRequest = z.object({
  userId: z.string().min(1),
  commuteDurationMinutes: z.number().int().min(1).max(600),
  destination: z.string().default("Destination"),
  energyLevel: energyInput.optional(),
  priorities: z.array(z.object({
    activity: z.string(),
    significance: z.number().min(0).max(10),
    urgency: z.number().min(0).max(10).default(2),
  })).default([]),
  context: z.record(z.any()).default({}),
  /** Optional raw voice answers; interpreted into priorities/energy. */
  utterances: z.array(z.union([z.string(), z.object({ question: z.string().optional(), answer: z.string() })])).default([]),
  eta: z.string().optional(),
});

export const EventIn = z.object({
  type: z.string().default("email"),
  source: z.string().optional(),
  summary: z.string().min(1),
  urgency: z.number().min(0).max(10),
  significance: z.number().min(0).max(10).default(5),
});
export type EventIn = z.infer<typeof EventIn>;

export const ReplanRequest = z.object({
  userId: z.string().min(1),
  commuteId: z.string().min(1),
  remainingMinutes: z.number().min(0).max(600),
  currentActivity: z.string().nullable().optional(),
  userFeedback: z.string().optional(),
  newEvents: z.array(EventIn).default([]),
});

export const EventRequest = z.object({
  commuteId: z.string().min(1),
  type: z.string().default("email"),
  source: z.string().optional(),
  summary: z.string().min(1),
  urgency: z.number().min(0).max(10),
  significance: z.number().min(0).max(10).default(5),
  remainingMinutes: z.number().min(0).max(600).optional(),
  currentActivity: z.string().nullable().optional(),
});
