# TS.4.2 — Integration Tests

## Task
Write integration tests for the fetch → cache → query flow.

## Target
`tests/integration/`

## Process
1. `tests/integration/news-flow.test.ts`:
   - POST /api/news/refresh → articles cached in news_cache
   - GET /api/news/portfolio → articles filtered by user's tickers
   - PATCH article state → is_read/is_dismissed persisted
   - Dismissed articles excluded from subsequent GET
2. `tests/integration/news-rate-limit.test.ts`:
   - Second refresh within 15 min → rate_limited: true
   - After 15 min → refresh succeeds
3. `tests/integration/news-purge.test.ts`:
   - Articles older than 24h purged by cron
   - user_article_state cascades on article deletion

## Outputs
- `tests/integration/news-flow.test.ts`
- `tests/integration/news-rate-limit.test.ts`
- `tests/integration/news-purge.test.ts`

## Verify
- All integration tests pass

## Handoff
→ TS.4.3 (E2E tests)
