# TS.2.3 — News Refresh Route

## Task
Implement POST /api/news/refresh for manual re-fetch with 15-minute rate-limit guard.

## Target
`app/api/news/refresh/route.ts`

## Inputs
- Sprint 1 TS.1.1 outputs (newsService)
- `docs/architecture/components/06_news_feed/03-news_refresh_route.md`

## Process
1. Create `app/api/news/refresh/route.ts`:
   - **15-min guard:** Check if last refresh was < 15 min ago (per user or global)
     - If too soon: return `{ rate_limited: true, retry_after_seconds: N }`
   - Fetch user's holding tickers
   - Call `newsService.fetchFinnhubNews()` + `newsService.fetchFmpNews()`
   - Deduplicate via `deduplicateArticles()`
   - Upsert all articles into `news_cache`
   - Return `{ articles_fetched: N, rate_limited: false }`
2. This is the ONLY way to trigger a fresh news fetch — no background polling
3. Rate limit from Finnhub: pass through `rate_limited: true` to UI

## Outputs
- `app/api/news/refresh/route.ts`

## Verify
- Fresh articles fetched and cached
- 15-min guard prevents rapid re-fetch
- Rate limit passthrough to UI

## Handoff
→ TS.2.4 (Article state route)
