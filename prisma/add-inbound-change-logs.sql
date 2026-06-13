CREATE TABLE IF NOT EXISTS inbound_change_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES inbound_sessions(id) ON DELETE CASCADE,
  line_id UUID REFERENCES inbound_lines(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id),
  field TEXT NOT NULL,
  from_value TEXT NOT NULL,
  to_value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inbound_change_logs_session_id_idx
  ON inbound_change_logs (session_id, created_at DESC);
