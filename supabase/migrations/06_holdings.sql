-- Migration 06: holdings table + RLS
-- One row per (silo_id, asset_id). Stores current quantity, cost basis, and cash balance.
-- quantity and all monetary values are NUMERIC(20,8) — no float arithmetic.
-- source tracks whether the row was entered manually or synced from a broker.

CREATE TABLE holdings (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  silo_id          UUID          NOT NULL REFERENCES silos(id) ON DELETE CASCADE,
  asset_id         UUID          NOT NULL REFERENCES assets(id),
  quantity         NUMERIC(20,8) NOT NULL DEFAULT 0,
  cost_basis       NUMERIC(20,8),
  cash_balance     NUMERIC(20,8) NOT NULL DEFAULT 0,
  last_updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  source           TEXT          NOT NULL DEFAULT 'manual',
  -- Allowed values: 'manual' | 'alpaca_sync' | 'bitkub_sync' | 'innovestx_sync' | 'schwab_sync' | 'webull_sync'
  UNIQUE(silo_id, asset_id)
);

ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY holdings_owner ON holdings
  USING (silo_id IN (SELECT id FROM silos WHERE user_id = auth.uid()));
