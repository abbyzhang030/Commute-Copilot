export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

-- Baseline + explicit preferences (high trust). value is JSON.
CREATE TABLE IF NOT EXISTS preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'baseline', -- baseline | explicit | inferred
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);

CREATE TABLE IF NOT EXISTS commutes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  destination TEXT,
  total_duration_minutes INTEGER NOT NULL,
  remaining_minutes INTEGER NOT NULL,
  energy_level INTEGER,
  current_activity TEXT,
  current_plan_json JSONB,
  initial_plan_json JSONB,
  priorities_json JSONB,          -- significance/urgency per activity (this commute)
  temp_state_json JSONB,          -- TEMPORARY preferences for this commute only
  context_json JSONB,
  context_key TEXT,               -- bucket used for learned preferences
  status TEXT NOT NULL DEFAULT 'active' -- active | completed
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  commute_id TEXT NOT NULL REFERENCES commutes(id),
  type TEXT NOT NULL,
  planned_minutes INTEGER NOT NULL,
  actual_minutes INTEGER,
  significance DOUBLE PRECISION,
  urgency DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'planned', -- planned | done
  order_index INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback_events (
  id TEXT PRIMARY KEY,
  commute_id TEXT NOT NULL REFERENCES commutes(id),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_feedback TEXT NOT NULL,
  interpreted_change_json JSONB,
  activity_type TEXT,
  temporary_or_long_term TEXT NOT NULL DEFAULT 'temporary'
);

-- Slowly learned, context-scoped preferences (EMA + confidence + observation count).
CREATE TABLE IF NOT EXISTS learned_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  context_key TEXT NOT NULL,
  preference_key TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
  observations INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, context_key, preference_key)
);

CREATE TABLE IF NOT EXISTS incoming_events (
  id TEXT PRIMARY KEY,
  commute_id TEXT NOT NULL REFERENCES commutes(id),
  type TEXT NOT NULL,
  source TEXT,
  summary TEXT NOT NULL,
  urgency DOUBLE PRECISION NOT NULL,
  significance DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  handled BOOLEAN NOT NULL DEFAULT false,
  disposition TEXT
);
`;
