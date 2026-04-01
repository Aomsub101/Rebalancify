# 12 — news_purge_cron

## The Goal

Automatically delete articles from `news_cache` older than 24 hours, enforcing the cache's stated TTL and preventing unbounded table growth. This runs as a SQL-only pg_cron job — no application code involved.

---

## The Problem It Solves

`news_cache` is a shared, append-only cache. Without a purge job, it would accumulate articles indefinitely, eventually reaching millions of rows. A 24-hour TTL is appropriate for news — older articles are stale and no longer useful to users.

---

## Implementation Details

**File:** `supabase/migrations/18_pg_cron_news_purge.sql`

```sql
SELECT cron.schedule(
  'news-cache-purge-daily',
  '0 2 * * *',   -- 02:00 UTC every day
  $$DELETE FROM news_cache WHERE fetched_at < NOW() - INTERVAL '24 hours'$$
);
```

### Prerequisites

The `pg_cron` extension must be enabled in the Supabase project before running this migration. The migration comment includes the pre-flight check:

```sql
SELECT extname FROM pg_extension WHERE extname = 'pg_cron';
```

### Why 02:00 UTC?

- Midnight to 6am UTC is typically low-traffic for global apps
- Avoids overlap with the drift digest cron at 08:00 UTC
- The news cache TTL (24h) means articles fetched at 02:00 UTC the previous day are the ones deleted

### SQL-Only

No application code, no Supabase SDK calls, no Vercel Cron. This is pure SQL scheduled by `pg_cron.schedule()`. It runs inside the Postgres database itself.

### Cascade Cleanup

Because `user_article_state` has `ON DELETE CASCADE` referencing `news_cache(id)`, deleted articles automatically remove their associated per-user state rows. No orphaned state rows are left behind.

---

## Testing & Verification

| Check | Method |
|---|---|
| pg_cron extension enabled | SQL: `SELECT extname FROM pg_extension WHERE extname = 'pg_cron'` → returns row |
| Job scheduled | SQL: `SELECT * FROM cron.job WHERE jobid = 'news-cache-purge-daily'` → row exists |
| Job runs at 02:00 UTC | Verify cron expression `'0 2 * * *'` |
| Articles older than 24h deleted | Manual: insert article with `fetched_at = NOW() - 25h` → wait for cron → article gone |
| Articles newer than 24h kept | Manual: insert article with `fetched_at = NOW() - 1h` → cron runs → article present |
| Cascade: user_article_state also deleted | Manual: insert article → user marks read → cron deletes article → state row also gone |
