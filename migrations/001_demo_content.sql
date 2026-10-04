-- Additive demo-content migration. Safe to run repeatedly; does not modify existing rows.
CREATE TABLE IF NOT EXISTS presentations (
  id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), title TEXT NOT NULL,
  presentation_time TIMESTAMPTZ, audience TEXT NOT NULL, duration_minutes INTEGER NOT NULL,
  objective TEXT NOT NULL, main_thesis TEXT NOT NULL, opening_script TEXT NOT NULL,
  closing_script TEXT NOT NULL, estimated_prep_time_minutes INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS presentation_slides (
  id TEXT PRIMARY KEY, presentation_id TEXT NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
  slide_number INTEGER NOT NULL, title TEXT NOT NULL, purpose TEXT NOT NULL,
  key_points JSONB NOT NULL, speaker_notes TEXT NOT NULL, transition_to_next_slide TEXT NOT NULL,
  important_concepts JSONB NOT NULL, UNIQUE (presentation_id, slide_number)
);
CREATE TABLE IF NOT EXISTS presentation_questions (
  id TEXT PRIMARY KEY, presentation_id TEXT NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
  question TEXT NOT NULL, why_they_might_ask TEXT NOT NULL, suggested_answer TEXT NOT NULL,
  key_point_to_remember TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY, course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_order INTEGER NOT NULL, title TEXT NOT NULL, topic TEXT NOT NULL,
  short_description TEXT NOT NULL, difficulty TEXT NOT NULL,
  estimated_duration_minutes INTEGER NOT NULL, full_lecture_script TEXT NOT NULL,
  previous_lesson_id TEXT REFERENCES lessons(id), next_lesson_id TEXT REFERENCES lessons(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (course_id, lesson_order)
);
CREATE TABLE IF NOT EXISTS user_learning_progress (
  user_id TEXT NOT NULL REFERENCES users(id), course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  current_lesson_id TEXT REFERENCES lessons(id), completed_lessons JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (user_id, course_id)
);
