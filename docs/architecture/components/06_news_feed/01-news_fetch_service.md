# 01 — News Fetch Service

## The Goal

Provide pure, server-side functions for fetching news from Finnhub and FMP, normalising their different response shapes into a unified `NewsArticle` type, and deduplicating articles that appear in both sources.

---

## The Problem It Solves

Finnhub and FMP have completely different API shapes, ID schemes, and rate limits. Wrapping both in a shared service layer allows the API routes to remain simple orchestrators while the parsing, deduplication, and rate-limit logic lives in testable pure functions.

---

## Implementation Details

**File:** `lib/newsService.ts`

### NewsArticle Shape

```typescript
interface NewsArticle {
  externalId: string   // 'finnhub-<id>' or 'fmp-<url>'
  source: 'finnhub' | 'fmp'
  tickers: string[]   // e.g. ['AAPL', 'MSFT']
  headline: string
  summary: string | null
  url: string
  publishedAt: Date | null
  isMacro: boolean   // true when tickers=[]
}
```

### Finnhub Fetching — `fetchFinnhubNews(apiKey, tickers, isMacro)`

**Macro path:** `GET https://finnhub.io/api/v1/news?category=general&token=<key>`
- Returns a flat array of articles
- HTTP 429 → returns `{ articles: [], rateLimited: true, failed: false }`
- Other non-ok → returns `{ articles: [], rateLimited: false, failed: true }`

**Portfolio path:** One call per ticker to `GET https://finnhub.io/api/v1/company-news?symbol=<ticker>&from=<30d ago>&to=<today>`
- 30-day lookback window
- HTTP 429 → stop immediately (do not process remaining tickers), return accumulated articles with `rateLimited: true`
- Other non-ok → skip this ticker, continue with next

**Finnhub article → NewsArticle:**
- `externalId = 'finnhub-<id>'`
- `tickers` parsed from `related` field (comma-separated string)
- `isMacro = true` when `category === 'general'` or `tickers === []`
- `publishedAt` from `datetime` Unix timestamp (multiplied by 1000)

### FMP Fetching — `fetchFmpNews(apiKey, tickers)`

**URL:** `GET https://financialmodelingprep.com/api/v3/stock_news?tickers=<comma>&limit=50&apikey=<key>`

- FMP has no free-tier rate limit header — any non-2xx treated as failure
- FMP has no stable numeric ID — `externalId = 'fmp-<url>'`
- If `tickers` is empty, fetches general news (no ticker filter)
- `isMacro = true` when `symbol` field is absent

### Deduplication — `deduplicateArticles(articles)`

O(n) Set-based deduplication using `externalId` as the key. First occurrence wins.

---

## Testing & Verification

| Check | Method |
|---|---|
| Finnhub 429 → returns immediately | Manual: exhaust Finnhub quota → `rateLimited: true` |
| Finnhub 429 mid-batch → returns accumulated | Unit test: 429 on ticker 3 of 5 → articles 1–2 returned |
| FMP non-2xx → `failed: true` | Manual: bad FMP key → `failed: true` |
| Deduplication removes Finnhub+FMP overlap | Integration: same article from both sources → appears once |
| `isMacro = true` when no tickers | Unit test: article with `related: ''` → `isMacro: true` |
| `publishedAt` null when datetime missing | Unit test: article with no `datetime` → `publishedAt: null` |
