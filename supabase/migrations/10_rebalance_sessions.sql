-- Migration 10: rebalance_sessions table + RLS
-- Immutable append-only records. Rows are created once and never UPDATEd except
-- for two permitted exceptions (see CLAUDE.md Rule 9):
--   1. snapshot_after: populated after Alpaca execution completes.
--   2. status: transitioned by POST /api/silos/:id/rebalance/execute only.
-- No updated_at column — intentional (sessions are immutable by design).

CREATE TABLE rebalance_sessions (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  silo_id          UUID          NOT NULL REFERENCES silos(id),
  user_id          UUID          NOT NULL REFERENCES auth.users(id),
  mode             TEXT          NOT NULL,
  -- Allowed values: 'partial' | 'full'
  cash_included    BOOLEAN       NOT NULL DEFAULT FALSE,
  cash_amount      NUMERIC(20,8),
  weights_sum_pct  NUMERIC(6,3)  NOT NULL,
  cash_target_pct  NUMERIC(6,3)  NOT NULL,
  snapshot_before  JSONB         NOT NULL,
  -- Schema: { holdings: [...], prices: {...}, weights: {...}, total_value: "string" }
  snapshot_after   JSONB,
  -- Populated after execution for API silos; NULL for manual silos
  status           TEXT          NOT NULL DEFAULT 'pending',
  -- Allowed values: 'pending' | 'approved' | 'partial' | 'cancelled'
  -- State machine: see docs/architecture/02-database-schema.md
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  -- NO updated_at — sessions are immutable
);

ALTER TABLE rebalance_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY rebal_sessions_owner ON rebalance_sessions
  USING (user_id = auth.uid());
