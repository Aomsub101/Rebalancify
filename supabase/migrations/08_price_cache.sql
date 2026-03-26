-- Migration 08: price_cache table + price_cache_fresh view + RLS
-- Global single-row-per-asset price cache. No price history is ever stored.
-- Cache TTL: 15 minutes (enforced by the price fetch API routes, not DB constraint).
-- price_cache_fresh view adds an is_fresh boolean for UI staleness indicators.
-- All authenticated users can read; writes are service-role only.

CREATE TABLE price_cache (
  asset_id    UUID          PRIMARY KEY REFERENCES assets(id),
  price       NUMERIC(20,8) NOT NULL,
  currency    CHAR(3)       NOT NULL,
  fetched_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  source      TEXT          NOT NULL
  -- Allowed values: 'finnhub' | 'coingecko' | 'alpaca' | 'bitkub'
);

CREATE VIEW price_cache_fresh AS
  SELECT *, (NOW() - fetched_at) < INTERVAL '15 minutes' AS is_fresh
  FROM price_cache;

ALTER TABLE price_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY price_cache_read ON price_cache FOR SELECT USING (TRUE);
