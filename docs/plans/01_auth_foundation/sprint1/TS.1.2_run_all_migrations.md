# TS.1.2 — Run All Migrations

## Task
Execute all database migrations in dependency order to create the full schema.

## Target
`supabase/migrations/` directory

## Inputs
- TS.1.1 outputs (live Supabase instance)
- `docs/architecture/02-database-schema.md` (canonical schema + migration order)

## Process
1. Create migration files in `supabase/migrations/` following the exact order:
   - `01_users_trigger.sql` — auth trigger
   - `02_user_profiles.sql` — user profiles with all encrypted credential columns
   - `03_assets.sql` — global asset registry
   - `04_silos.sql` — investment silos
   - `05_asset_mappings.sql` — silo-asset mappings
   - `06_holdings.sql` — holdings per silo
   - `07_target_weights.sql` — target weight allocations
   - `08_price_cache.sql` — global price cache + `price_cache_fresh` view
   - `09_fx_rates.sql` — FX rates cache
   - `10_rebalance_sessions.sql` — immutable rebalance sessions
   - `11_rebalance_orders.sql` — rebalance order rows
   - `12_news_cache.sql` — news article cache + GIN index
   - `13_user_article_state.sql` — per-user read/dismiss state
   - `14_knowledge_chunks.sql` — v2.0 RAG corpus + HNSW index
   - `15_research_sessions.sql` — v2.0 research output cache
   - `16_notifications.sql` — drift + token expiry notifications
   - `17_pg_cron_drift_digest.sql` — pg_cron job for drift alerts
   - `18_pg_cron_news_purge.sql` — pg_cron job for news cleanup
   - `23_asset_historical_data.sql` — v2.0 historical price cache
2. Run `supabase db push` or apply via Supabase dashboard
3. Verify all tables exist with correct columns and constraints

## Outputs
- All tables, views, indexes, and constraints created
- v2.0 tables exist but are unused until their respective phases

## Verify
- `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'` lists all expected tables
- `price_cache_fresh` view returns `is_fresh` column
- HNSW index exists on `knowledge_chunks.embedding`

## Handoff
→ TS.1.3 (auth trigger needs `user_profiles` table)
