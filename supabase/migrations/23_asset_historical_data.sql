-- Migration: 23_asset_historical_data
-- Creates the asset_historical_data table for stale-while-revalidate price history caching.
-- This table is a global read-cache written by server-side code only (no RLS).
-- Read by: POST /api/optimize Python function (service role key).
-- Written by: yfinance fetch in lib/priceHistory.ts on cache miss or stale cache.

CREATE TABLE asset_historical_data (
  ticker             TEXT        PRIMARY KEY,
  historical_prices JSONB       NOT NULL,
  -- Array of { date: "YYYY-MM-DD", close: number }
  -- Sorted by date ascending
  last_updated      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No RLS needed: global read cache, server-written only
-- No index needed: PRIMARY KEY on ticker is sufficient for lookups
