-- Additive, idempotent mock inbox schema. Existing application data is untouched.
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
