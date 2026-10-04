# Commute Copilot — Coordinator backend

Adaptive commute coordinator: plans, replans the *remaining* commute, handles urgent events, persists to Neon, learns slowly.

## Run
```bash
npm install
cp .env.example .env     # optional: DATABASE_URL (Neon), ANTHROPIC_API_KEY (Mastra agent)
npm run db:init          # creates tables + seeds demo-user (also auto-runs on boot)
npm start                # http://localhost:8787
npm run demo             # full demo scenario, in-process
```
No `DATABASE_URL` → embedded Postgres (PGlite, `.data/`). LLM: `NEON_AI_GATEWAY_TOKEN` + `NEON_AI_GATEWAY_BASE_URL` (Neon credits) → else `ANTHROPIC_API_KEY` → else keyword interpreter.

## API (JSON)
| Endpoint | Purpose |
|---|---|
| `POST /api/plan` | Initial plan. Optional `utterances: string[]` for raw voice answers. |
| `POST /api/replan` | `{userId, commuteId, remainingMinutes, currentActivity, userFeedback, newEvents}` |
| `POST /api/event` | `{commuteId, type, summary, urgency, significance, remainingMinutes?, currentActivity?}`; interrupts only if urgency ≥ threshold (default 7) |
| `POST /api/activity-result` | `{commuteId, type, actualMinutes}` — report what actually played (replans credit it) |
| `POST /api/complete` | Finish commute; feeds long-term learning |
| `GET /api/commute/:id`, `/api/users/:id/learned`, `/api/users/:id/preferences` | Inspect state |

Every plan response: `spokenResponse`, `reason`, `interruptCurrentActivity`, `currentAction`, `updatedPlan` (alias `plan`), items `{type, minutes, significance, urgency, label}`. Plan minutes always sum exactly to remaining time.

## Design
- **LLM interprets, code plans.** The Mastra agent turns free text into a structured `Interpretation`; `planner.ts` does all time allocation deterministically, so totals always fit and a failed/slow LLM (8s timeout) falls back to keywords.
- **Temporary vs long-term.** In-commute feedback lives in `commutes.temp_state_json`. `preferences` changes only on explicit "always / from now on" (small nudge). `learned_preferences` are context-bucketed EMAs (single feedback α=0.04, completed commute α=0.1), confidence = 1−e^(−n/13).
- **Urgency vs significance.** Events are classified critical (≥9) / high (≥threshold) / notable (≥threshold−3, flagged at next break) / low (held for arrival).
