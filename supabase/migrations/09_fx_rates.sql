-- Migration 09: fx_rates table + RLS
-- Global FX rate store. One row per currency (keyed by currency code).
-- Cache TTL: 60 minutes (enforced by GET /api/fx-rates route, not DB constraint).
-- All authenticated users can read; writes are service-role only.

CREATE TABLE fx_rates (
  currency      CHAR(3)       PRIMARY KEY,
  rate_to_usd   NUMERIC(20,8) NOT NULL,
  fetched_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE fx_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY fx_rates_read ON fx_rates FOR SELECT USING (TRUE);
