# Component 6 — News Feed

## 1. The Goal

Deliver a user-triggered news aggregation surface covering both portfolio-specific articles (filtered by the user's held tickers) and general macro financial news. All news is fetched from Finnhub and FMP with rate-limit handling, cached globally in `news_cache` for 24 hours, and surfaced with per-user read/dismiss state. Refreshes are always explicit user actions — no background polling.

---

## 2. The Problem It Solves

Investors need to stay informed about developments affecting their specific holdings and the broader market, but Finnhub and FMP both enforce aggressive rate limits (60 calls/min and 250 calls/day respectively) that make per-user real-time news fetching impractical. A shared global cache with 24-hour retention satisfies the majority of news reads without hammering the external APIs, while per-user state (read/dismiss) ensures the UI is personalised without duplicating fetch work.

---

## 3. The Proposed Solution / Underlying Concept

### News Fetch Service (STORY-021)

`lib/newsService.ts` is the core news aggregation service. It is called by API routes, never directly by components.

**Rate-limit aware fetching:**
- Finnhub: 60 calls/min — tracked via an in-memory sliding window counter. If quota is exhausted, FMP is tried as primary for the next request.
- FMP: 250 calls/day — tracked via date-keyed counter. If exhausted, stale cached data is returned.

**Two-tier news caching:**
1. **Global cache** (`news_cache` table, 24-hour retention): fetched articles from both providers, shared across all users
2. **Per-user state** (`user_article_state` table): `read` or `dismiss` per article per user

**Cache purge**: A pg_cron job (migration 18, daily 02:00 UTC) deletes `news_cache` rows older than 24 hours. This is SQL-only — no application code involved.

### Portfolio News Filtering (STORY-022)

When fetching portfolio news, the ticker list comes from `holdings` across all of a user's silos (via Component 2 API). Two-tier filtering:

1. **Exact ticker match**: article mentions a held ticker in its Finnhub `related` field
2. **Enriched tag matching**: if no exact matches, check if the article's Finnhub `category` or `source` matches a broader portfolio theme (e.g., "financial markets", "economy")

Macro news bypasses portfolio filtering and shows all articles.

### News Article State (STORY-021)

| State | Meaning |
|---|---|
| `read` | User has opened the article (clicked through) |
| `dismiss` | User explicitly dismissed the article (× button) |
| Neither | Article is new/unread |

`user_article_state` rows are created on first interaction (read or dismiss). Articles not in this table are "new" for that user.

### News Page UI (STORY-023)

The news page has two tabs:

- **Portfolio News**: filtered to user's holdings tickers
- **Macro News**: general financial news, not filtered

Components:
- `ArticleCard` — headline, source, timestamp, ticker badges, read/dismiss buttons
- `ArticleList` — scrollable list of `ArticleCard` entries
- `RefreshBar` — "Last updated X minutes ago" + manual refresh button
- `RateLimitBanner` — shown when Finnhub quota is exhausted, suggesting the user wait or switch to macro news

**Graceful degradation**: If the global cache has fresh articles, they are shown even when Finnhub is rate-limited. If the cache is stale and the user hits refresh, the `RateLimitBanner` is shown but cached articles remain visible.

### Article Data Shape

Finnhub article shape (simplified):
```typescript
{
  id: string,
  headline: string,
  source: string,
  url: string,
  datetime: number,        // unix timestamp
  related: string[],       // tickers
  category: string
}
```

FMP article shape (simplified):
```typescript
{
  symbol: string | null,   // ticker (null for macro)
  title: string,
  published: string,       // ISO datetime
  link: string
}
```

Cached articles are stored in `news_cache` with a `provider` column to distinguish Finnhub vs FMP origin.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Finnhub rate limit tracking | Unit: call news service 60 times in one minute → 61st call redirects to FMP |
| FMP daily limit tracking | Unit: 250 calls on day X → 251st call returns cached data |
| Cache hit — no external call | Unit: fetch same ticker within 24h → zero external API calls |
| Per-user article state | Two-user test: user A dismisses article → user B still sees it as unread |
| Portfolio filtering — exact match | Unit: holdings include AAPL → article with `related: ['AAPL']` appears in portfolio tab |
| Portfolio filtering — tag fallback | Unit: no exact matches → article with `category: 'economy'` appears if portfolio has broad exposure |
| RateLimitBanner shown | Manual: exhaust Finnhub quota → banner appears |
| Graceful degradation | Manual: Finnhub exhausted + cache has stale articles → articles still shown, banner visible |
| Cache purge | SQL: insert 25-hour-old article → pg_cron runs → article deleted |
| "This is not financial advice" | Manual: news page visible → disclaimer present in footer (Component 9 cross-cutting) |

---

## 5. Integration

### API Routes

| Method + Path | What It Does |
|---|---|
| `GET /api/news/portfolio` | Fetches portfolio tickers from Component 2, fetches filtered articles from `newsService` |
| `GET /api/news/macro` | Fetches general financial news (no ticker filter) |
| `POST /api/news/articles/:id/read` | Marks article as read for current user |
| `POST /api/news/articles/:id/dismiss` | Marks article as dismissed for current user |
| `app/api/cron/news-purge/route.ts` | (pg_cron handles this; Vercel Cron not needed for news) |

### Database Tables

| Table | RLS | Purpose |
|---|---|---|
| `news_cache` | Read-all | Global article cache (24h TTL, purged by pg_cron) |
| `user_article_state` | Yes | Per-user read/dismiss state |

### Consumed From

| Component | What It Provides |
|---|---|
| **Component 2 — Portfolio Data Layer** | `GET /api/silos` + `GET /api/silos/:id/holdings` → ticker list for portfolio news filtering |
| **Component 5 — Market Data** | Indirectly via Finnhub and FMP API calls (no direct integration) |

### UI Components

| Component | Where Used |
|---|---|
| `components/news/ArticleCard.tsx` | News page (both tabs) |
| `components/news/ArticleList.tsx` | News page container |
| `components/news/RefreshBar.tsx` | News page header |
| `components/news/RateLimitBanner.tsx` | Shown when Finnhub quota exhausted |
| `components/shared/EmptyState.tsx` | When no articles available |
| `components/shared/LoadingSkeleton.tsx` | During initial load |
| `components/shared/ErrorBanner.tsx` | When all sources fail |

### External APIs

| Provider | Purpose | Rate Limit |
|---|---|---|
| Finnhub `/news` | Financial news articles | 60 calls/min |
| FMP `/feed` | News fallback | 250 calls/day |
