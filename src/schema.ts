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

-- Seeded presentation-prep content.
CREATE TABLE IF NOT EXISTS presentations (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  title TEXT NOT NULL,
  presentation_time TIMESTAMPTZ,
  audience TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  objective TEXT NOT NULL,
  main_thesis TEXT NOT NULL,
  opening_script TEXT NOT NULL,
  closing_script TEXT NOT NULL,
  estimated_prep_time_minutes INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS presentation_slides (
  id TEXT PRIMARY KEY,
  presentation_id TEXT NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
  slide_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  purpose TEXT NOT NULL,
  key_points JSONB NOT NULL,
  speaker_notes TEXT NOT NULL,
  transition_to_next_slide TEXT NOT NULL,
  important_concepts JSONB NOT NULL,
  UNIQUE (presentation_id, slide_number)
);

CREATE TABLE IF NOT EXISTS presentation_questions (
  id TEXT PRIMARY KEY,
  presentation_id TEXT NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  why_they_might_ask TEXT NOT NULL,
  suggested_answer TEXT NOT NULL,
  key_point_to_remember TEXT NOT NULL
);

-- Seeded, audio-first learning content.
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  short_description TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  estimated_duration_minutes INTEGER NOT NULL,
  full_lecture_script TEXT NOT NULL,
  previous_lesson_id TEXT REFERENCES lessons(id),
  next_lesson_id TEXT REFERENCES lessons(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, lesson_order)
);

CREATE TABLE IF NOT EXISTS user_learning_progress (
  user_id TEXT NOT NULL REFERENCES users(id),
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  current_lesson_id TEXT REFERENCES lessons(id),
  completed_lessons JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS demo_emails (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  thread_id TEXT,
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  body TEXT NOT NULL,
  short_summary TEXT NOT NULL,
  importance INTEGER NOT NULL,
  urgency INTEGER NOT NULL,
  category TEXT NOT NULL,
  requires_response BOOLEAN NOT NULL DEFAULT false,
  suggested_action TEXT NOT NULL,
  response_deadline TIMESTAMPTZ,
  related_meeting_id TEXT,
  related_presentation_id TEXT REFERENCES presentations(id),
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
