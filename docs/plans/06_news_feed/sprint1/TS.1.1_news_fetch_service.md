# TS.1.1 — News Fetch Service

## Task
Implement lib/newsService.ts for fetching, parsing, and deduplicating news from Finnhub + FMP.

## Target
`lib/newsService.ts`

## Inputs
- `docs/architecture/components/06_news_feed/01-news_fetch_service.md`

## Process
1. Create `lib/newsService.ts`:
   - `fetchFinnhubNews(apiKey, tickers, isMacro)` — GET Finnhub company/general news, handle 429
   - `fetchFmpNews(apiKey, tickers)` — GET FMP news, treat non-2xx as failure
   - `parseFinnhubArticle(raw)` → `NewsArticle | null` (normalize fields)
   - `parseFmpArticle(raw)` → `NewsArticle | null`
   - `deduplicateArticles(articles)` — O(n) Set-based dedup by `externalId`
2. NewsArticle shape: `{ externalId, source, tickers[], headline, summary, url, published_at, is_macro, metadata? }`
3. Rate limit: Finnhub 429 → return empty array + `rate_limited: true` flag
4. Upsert into news_cache via service-role client

## Outputs
- `lib/newsService.ts`

## Verify
- Finnhub articles parsed correctly
- FMP articles parsed correctly
- Deduplication removes duplicates by externalId
- Rate limit → graceful empty response

## Handoff
→ TS.1.2 (News query service)
