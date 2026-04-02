# TS.1.4 — News Purge Cron

## Task
Create pg_cron job to purge news_cache rows older than 24 hours.

## Target
`supabase/migrations/18_pg_cron_news_purge.sql`

## Inputs
- `docs/architecture/components/06_news_feed/12-news_purge_cron.md`

## Process
1. Create migration 18: pg_cron job running daily at 02:00 UTC
   ```sql
   SELECT cron.schedule('purge-old-news', '0 2 * * *',
     $$DELETE FROM news_cache WHERE fetched_at < NOW() - INTERVAL '24 hours'$$
   );
   ```
2. This keeps the news_cache table compact (only last 24h of articles)
3. user_article_state rows referencing deleted articles cascade via FK ON DELETE CASCADE

## Outputs
- `supabase/migrations/18_pg_cron_news_purge.sql`

## Verify
- Cron job registered in pg_cron.job table
- Old articles purged correctly
- user_article_state rows cascade on article deletion

## Handoff
→ Sprint 2 (API routes)
