# TS.1.2 — Price Cache Migration

## Task
Create price_cache table and price_cache_fresh view via Supabase migration.

## Target
`supabase/migrations/08_price_cache.sql`

## Inputs
- `docs/architecture/02-database-schema.md` (price_cache)
- `docs/architecture/components/05_market_data_pricing/03-price_cache_table.md`

## Process
1. Create `price_cache` table: asset_id (UUID PK FK), price (NUMERIC 20,8), currency (CHAR 3), fetched_at (TIMESTAMPTZ), source (TEXT)
2. Create `price_cache_fresh` view: adds `is_fresh` boolean column (`NOW() - fetched_at < 15 minutes`)
3. RLS: `SELECT USING (TRUE)` — all authenticated users can read. Writes service-role only.
4. Allowed source values: 'finnhub' | 'coingecko' | 'alpaca' | 'bitkub'

## Outputs
- `supabase/migrations/08_price_cache.sql`

## Verify
- Table created with correct schema
- View returns `is_fresh` correctly
- RLS allows read-all, blocks user writes

## Handoff
→ TS.1.3 (Price API route)
