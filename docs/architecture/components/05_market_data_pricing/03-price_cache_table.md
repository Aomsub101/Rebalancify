# 03 — price_cache Table

## The Goal

Provide a shared, global, per-asset price cache that all components can read from and write to. Each row stores the most recent price for one asset, keyed by `asset_id`, with a 15-minute TTL enforced by the `price_cache_fresh` view.

---

## The Problem It Solves

Without a shared cache, every component would independently call Finnhub or CoinGecko for the same asset, consuming rate limits rapidly. A single-row-per-asset cache means at most one external API call per asset per 15 minutes, regardless of how many components need the price.

---

## Schema

```sql
CREATE TABLE price_cache (
  asset_id    UUID PRIMARY KEY REFERENCES assets(id),
  price       NUMERIC(20,8) NOT NULL,
  currency    CHAR(3) NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source      TEXT NOT NULL
  -- Allowed values: 'finnhub' | 'coingecko' | 'alpaca' | 'bitkub'
);
```

### price_cache_fresh View

```sql
CREATE VIEW price_cache_fresh AS
  SELECT *, (NOW() - fetched_at) < INTERVAL '15 minutes' AS is_fresh
  FROM price_cache;
```

The `is_fresh` boolean is computed at query time. It is `true` when `fetched_at` is within 15 minutes of `NOW()`.

### RLS Policy

```sql
ALTER TABLE price_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY price_cache_read ON price_cache FOR SELECT USING (TRUE);
```

All authenticated users can read `price_cache`. Writes (upserts) are service-role only — the Supabase service role key is used in broker sync routes and in `priceService.ts` called from API routes.

### No Price History

Per CLAUDE.md Rule 11: only the single most recent price per asset is stored. There are no historical price columns, no time-series data, and no `price_history` table.

---

## Testing & Verification

| Check | Method |
|---|---|
| `is_fresh = true` within 15 min | SQL: insert row with `fetched_at = NOW()` → query view → `is_fresh = true` |
| `is_fresh = false` after 15 min | SQL: insert row with `fetched_at = NOW() - INTERVAL '16 minutes'` → query view → `is_fresh = false` |
| No historical price columns | `grep` for `price_history` or timestamp columns on price_cache → zero hits |
| All authenticated users can read | RLS test: two users → both can SELECT price_cache |
| Writes require service role | RLS test: anon key → INSERT blocked |
