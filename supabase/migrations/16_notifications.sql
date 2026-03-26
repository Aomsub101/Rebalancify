-- Migration 16: notifications table + RLS
-- In-app notification store. Two types:
--   'drift_breach'          — populated by pg_cron job (migration 17)
--   'schwab_token_expiring' — populated by POST /api/silos/:id/sync when token nears expiry
-- silo_id is nullable (ON DELETE SET NULL) to preserve notifications after silo deletion.
-- notification_count is a derived field, not stored: COUNT(*) WHERE is_read = FALSE.

CREATE TABLE notifications (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL DEFAULT 'drift_breach',
  -- Allowed values: 'drift_breach' | 'schwab_token_expiring'
  message      TEXT        NOT NULL,
  silo_id      UUID        REFERENCES silos(id) ON DELETE SET NULL,
  asset_ticker TEXT,
  is_read      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_owner ON notifications
  USING (user_id = auth.uid());
