// End-to-end demo of the hackathon scenario, against the in-process app (no HTTP server needed).
process.env.PGLITE_DIR ??= "memory";
const { app } = await import("../src/server.js");
const { ensureUser } = await import("../src/coordinator.js");
await ensureUser("demo-user", "Demo User");

const post = async (path: string, body: unknown) => {
  const r = await app.request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return r.json() as Promise<any>;
};
const show = (p: any[]) => p.map((b) => `${b.type}:${b.minutes}`).join(" | ") + `  (total ${p.reduce((s, b) => s + b.minutes, 0)})`;

console.log("\n=== 1. Start commute (2h) ===");
const plan = await post("/api/plan", {
  userId: "demo-user", commuteDurationMinutes: 120, destination: "Work", energyLevel: 2,
  utterances: ["I have a presentation right after I arrive.", "The lecture is not due until Friday.", "I'm pretty tired."],
  context: { lectureDue: "Friday", presentationAfterArrival: true },
});
console.log(plan.spokenResponse, "\n", show(plan.plan));

// frontend reports what actually happened in the first 48 minutes
for (const [type, actualMinutes] of [["email_roundup", 10], ["presentation_prep", 30], ["music", 8]] as const)
  await post("/api/activity-result", { commuteId: plan.commuteId, type, actualMinutes });

console.log("\n=== 2. 48 min in, 72 left, mid-lecture: feedback ===");
const rp = await post("/api/replan", {
  userId: "demo-user", commuteId: plan.commuteId, remainingMinutes: 72, currentActivity: "lecture",
  userFeedback: "I think this is too much lecture. I want to not think so much and listen to more music.",
});
console.log(rp.spokenResponse, `\ninterrupt=${rp.interruptCurrentActivity} via=${rp.interpretedVia}\n`, show(rp.updatedPlan));

await post("/api/activity-result", { commuteId: plan.commuteId, type: "music", actualMinutes: 22 });

console.log("\n=== 3. Urgent email, 50 min left, during music ===");
const ev = await post("/api/event", {
  commuteId: plan.commuteId, type: "email", source: "boss", summary: "Boss says presentation slides changed.",
  urgency: 10, significance: 9, remainingMinutes: 50, currentActivity: "music",
});
console.log(ev.spokenResponse, `\ninterrupt=${ev.interrupt} level=${ev.level}\n`, show(ev.updatedPlan));

console.log("\n=== 4. Promo email (must NOT interrupt) ===");
const promo = await post("/api/event", { commuteId: plan.commuteId, type: "email", summary: "20% off this weekend", urgency: 1, significance: 1 });
console.log(`interrupt=${promo.interrupt} level=${promo.level} spoken=${JSON.stringify(promo.spokenResponse)}`);

console.log("\n=== 5. Persistence check ===");
const state = await (await app.request(`/api/commute/${plan.commuteId}`)).json() as any;
console.log("feedback events:", state.feedback.map((f: any) => `${f.temporary_or_long_term}: ${f.raw_feedback.slice(0, 40)}…`));
console.log("incoming events:", state.events.map((e: any) => `${e.disposition}/${e.handled}`));
console.log("temp state:", JSON.stringify(state.commute.temp_state_json));
const prefs = await (await app.request("/api/users/demo-user/preferences")).json() as any;
console.log("long-term music_weight (unchanged):", prefs.preferences.find((p: any) => p.key === "music_weight").value);
const learned = await (await app.request("/api/users/demo-user/learned")).json() as any;
console.log("learned:", learned.learned.map((l: any) => `${l.preference_key}=${l.value.toFixed(3)} conf=${l.confidence.toFixed(2)} n=${l.observations}`));
process.exit(0);
export {};
