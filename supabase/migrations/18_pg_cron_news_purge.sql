-- Migration 18: pg_cron news purge job
-- PRE-FLIGHT: run `SELECT extname FROM pg_extension WHERE extname = 'pg_cron';`
-- The 'pg_cron' extension MUST be enabled before running this migration.
--
-- Runs daily at 02:00 UTC. Deletes all news_cache rows older than 24 hours.
-- This enforces the 24-hour cache TTL documented in the news_cache table comments.
-- Runs at 02:00 UTC to avoid overlap with the drift digest job at 08:00 UTC.

SELECT cron.schedule(
  'news-cache-purge-daily',
  '0 2 * * *',
  $$DELETE FROM news_cache WHERE fetched_at < NOW() - INTERVAL '24 hours'$$
);
