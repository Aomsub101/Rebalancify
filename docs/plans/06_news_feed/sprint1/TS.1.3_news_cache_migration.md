# TS.1.3 — News Cache Migration

## Task
Create news_cache table with GIN index and metadata JSONB column.

## Target
`supabase/migrations/12_news_cache.sql`, `supabase/migrations/19_news_cache_metadata.sql`

## Inputs
- `docs/architecture/02-database-schema.md` (news_cache)
- `docs/architecture/components/06_news_feed/10-news_cache_table.md`

## Process
1. Migration 12: Create `news_cache` table with columns: id, external_id (UNIQUE), source, tickers (TEXT[]), headline, summary, url, published_at, is_macro, fetched_at
2. Create GIN index on `tickers` column for fast array overlap queries
3. RLS: `SELECT USING (TRUE)` — all authenticated users can read. Writes service-role only.
4. Migration 19: Add `metadata JSONB` column for related_tickers, sector, personnel
5. Also create `user_article_state` table (migration 13): user_id, article_id, is_read, is_dismissed, interacted_at, UNIQUE(user_id, article_id)
6. user_article_state RLS: `USING (user_id = auth.uid())`

## Outputs
- `supabase/migrations/12_news_cache.sql`
- `supabase/migrations/13_user_article_state.sql`
- `supabase/migrations/19_news_cache_metadata.sql`

## Verify
- GIN index exists on tickers column
- RLS correctly configured on both tables

## Handoff
→ TS.1.4 (News purge cron)
