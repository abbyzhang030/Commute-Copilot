# Commute Copilot

Voice-first driving frontend plus an adaptive Coordinator backend. The Coordinator plans and replans the *remaining* commute, handles urgent events, persists locally, and learns slowly.

## Run
```bash
npm install
npm run db:init          # creates tables + seeds demo-user (also auto-runs on boot)
npm start                # frontend + Coordinator at http://localhost:8787
npm run demo             # full demo scenario, in-process
```
No credentials are required for the fallback demo. With no `DATABASE_URL`, the backend uses embedded Postgres (PGlite, `.data/`). Configured model and Mapbox providers activate automatically; email, calendar, lecture, and media integrations keep their mock fallbacks.

## Mapbox

Add Mapbox tokens to the ignored local `.env` to enable the live map:

```bash
MAPBOX_PUBLIC_TOKEN=     # URL-restricted pk.* token used only by Mapbox GL JS
MAPBOX_ACCESS_TOKEN=     # server-side token used for Search Box and Directions
```

The backend proxies Search Box `/suggest` + `/retrieve` and Directions requests. Directions use the `mapbox/driving-traffic` profile and return normalized route geometry, traffic-aware ETA, distance, and `remainingMinutes`. If either Mapbox API fails, the same endpoints return the simulated route so the Coordinator and demo remain usable.

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
- **Intent adapter interprets, code plans.** The local adapter turns free text into a structured `Interpretation`; `planner.ts` does all time allocation deterministically, so totals always fit. A model-backed adapter can be added later without changing planning logic.
- **Temporary vs long-term.** In-commute feedback lives in `commutes.temp_state_json`. `preferences` changes only on explicit "always / from now on" (small nudge). `learned_preferences` are context-bucketed EMAs (single feedback α=0.04, completed commute α=0.1), confidence = 1−e^(−n/13).
- **Urgency vs significance.** Events are classified critical (≥9) / high (≥threshold) / notable (≥threshold−3, flagged at next break) / low (held for arrival).
