-- Migration 04: silos table + RLS
-- A silo is one portfolio bucket (one brokerage account or one manual portfolio).
-- Maximum 5 active silos per user — enforced at application layer, not DB constraint.
-- Soft-delete: DELETE /silos/:id sets is_active = FALSE, data is preserved.

CREATE TABLE silos (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT         NOT NULL,
  platform_type    TEXT         NOT NULL,
  -- Allowed values: 'alpaca' | 'bitkub' | 'innovestx' | 'schwab' | 'webull' | 'manual'
  base_currency    CHAR(3)      NOT NULL DEFAULT 'USD',
  drift_threshold  NUMERIC(5,2) NOT NULL DEFAULT 5.0,
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
  last_synced_at   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE silos ENABLE ROW LEVEL SECURITY;

CREATE POLICY silos_owner ON silos
  USING (user_id = auth.uid());
