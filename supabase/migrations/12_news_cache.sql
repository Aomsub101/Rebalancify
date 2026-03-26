-- Migration 12: news_cache table + GIN index + RLS
-- Global news article cache. Cache TTL: 24 hours.
-- GIN index on tickers array enables fast per-ticker article lookups.
-- Purged daily at 02:00 UTC by the pg_cron job in migration 18.
-- NOTE: 24-hour TTL applies here. Do not confuse with the 15-minute TTL on price_cache.
-- All authenticated users can read; writes are service-role only.

CREATE TABLE news_cache (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id  TEXT        NOT NULL UNIQUE,
  source       TEXT        NOT NULL,
  -- Allowed values: 'finnhub' | 'fmp'
  tickers      TEXT[]      NOT NULL,
  headline     TEXT        NOT NULL,
  summary      TEXT,
  url          TEXT        NOT NULL,
  published_at TIMESTAMPTZ,
  is_macro     BOOLEAN     NOT NULL DEFAULT FALSE,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX news_tickers_gin ON news_cache USING GIN (tickers);

ALTER TABLE news_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY news_cache_read ON news_cache FOR SELECT USING (TRUE);
