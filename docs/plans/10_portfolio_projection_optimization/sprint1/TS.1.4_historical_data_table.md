# TS.1.4 — Historical Data Table

## Task
Create asset_historical_data table for caching yfinance price history (24h TTL).

## Target
`supabase/migrations/23_asset_historical_data.sql`

## Inputs
- `docs/architecture/02-database-schema.md` (asset_historical_data)

## Process
1. Create migration:
   ```sql
   CREATE TABLE asset_historical_data (
     ticker           TEXT PRIMARY KEY,
     historical_prices JSONB NOT NULL,  -- [{ date, close }] ascending
     last_updated     TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   ```
2. No RLS: global read cache written by server-side code only (service role key)
3. Read by: POST /optimize on cache hit (< 24h old)
4. Written by: yfinance fetch in POST /optimize on cache miss
5. 24h TTL checked by optimizer: `last_updated > NOW() - INTERVAL '24 hours'`

## Outputs
- `supabase/migrations/23_asset_historical_data.sql`

## Verify
- Table created with correct schema
- No RLS (global cache)
- JSONB stores array of { date, close } correctly

## Handoff
→ Sprint 2 (Next.js proxy + frontend)
