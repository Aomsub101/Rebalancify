# 10 — news_cache Table

## The Goal

Provide a shared, global, per-article news cache with a 24-hour TTL, storing articles from both Finnhub and FMP in a normalised shape. This table is the source of truth for all news display and enables per-user filtering without additional external API calls.

---

## The Problem It Solves

Finnhub and FMP both enforce strict rate limits (60 calls/min and 250 calls/day respectively). Fetching fresh news per user would exhaust these limits immediately. A shared global cache means news is fetched once and shared across all users for 24 hours, dramatically reducing API consumption.

---

## Schema

```sql
-- Migration 12
CREATE TABLE news_cache (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id  TEXT NOT NULL UNIQUE,
  source       TEXT NOT NULL,       -- 'finnhub' | 'fmp'
  tickers      TEXT[] NOT NULL,
  headline     TEXT NOT NULL,
  summary      TEXT,
  url          TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  is_macro     BOOLEAN NOT NULL DEFAULT FALSE,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX news_tickers_gin ON news_cache USING GIN (tickers);
ALTER TABLE news_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY news_cache_read ON news_cache FOR SELECT USING (TRUE);

-- Migration 19
ALTER TABLE news_cache ADD COLUMN IF NOT EXISTS metadata JSONB;
-- Schema: { sector: string, related_tickers: string[],
--           related_terms: string[], personnel: string[] }
```

### Columns

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Internal identifier, exposed to client |
| `external_id` | TEXT UNIQUE | Provider's ID: `'finnhub-<id>'` or `'fmp-<url>'` |
| `source` | TEXT | `'finnhub'` or `'fmp'` |
| `tickers` | TEXT[] | GIN-indexed for fast array overlap queries |
| `headline` | TEXT | Article title |
| `summary` | TEXT | Optional article summary |
| `url` | TEXT | Link to original article |
| `published_at` | TIMESTAMPTZ | Publication time |
| `is_macro` | BOOLEAN | `TRUE` for general/macro articles |
| `fetched_at` | TIMESTAMPTZ | Used for 24-hour TTL purge |
| `metadata` | JSONB | Tier-2 enrichment data (migration 19) |

### GIN Index

The GIN index on `tickers` (`news_tickers_gin`) enables fast `ANY(tickers ARRAY[...])` overlap queries without sequential scans, even with thousands of cached articles.

### RLS

`SELECT USING (TRUE)` — all authenticated users can read `news_cache`. Writes are service-role only (via `SUPABASE_SERVICE_ROLE_KEY` in the refresh route).

---

## Testing & Verification

| Check | Method |
|---|---|
| `external_id` uniqueness enforced | DB constraint: two inserts with same `external_id` → second fails |
| GIN index used for ticker queries | `EXPLAIN` a portfolio news query → `Index Scan using news_tickers_gin on news_cache` |
| `metadata` column nullable | Migration 19 is additive — existing rows have `metadata = NULL` |
| RLS: all authenticated users can read | Two-user test: both can SELECT news_cache |
| RLS: writes require service role | Manual: anon key → INSERT blocked |
| 24h purge runs daily | `SELECT cron.jobid FROM cron.job` → `news-cache-purge-daily` visible |
