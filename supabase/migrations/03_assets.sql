-- Migration 03: assets table (global read-only registry)
-- Stores the canonical list of assets across all platforms.
-- Written only by the service role (admin bulk inserts, not user mutations).
-- All authenticated users can read; writes are service-role only.

CREATE TABLE assets (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker        TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  asset_type    TEXT    NOT NULL,
  -- Allowed values: 'stock' | 'crypto' | 'etf'
  price_source  TEXT    NOT NULL,
  -- Allowed values: 'finnhub' | 'coingecko' | 'alpaca' | 'bitkub'
  coingecko_id  TEXT,
  sector        TEXT,
  exchange      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX assets_ticker_source ON assets(ticker, price_source);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY assets_read ON assets FOR SELECT USING (TRUE);
