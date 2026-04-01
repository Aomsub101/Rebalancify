# Component 6 — News Feed: As-Built PRD

## 1. Concept & Vision

The News Feed delivers a user-triggered, personalised news surface covering both portfolio-specific articles (filtered by the user's held tickers) and general macro financial news. All news is fetched from Finnhub and FMP, cached globally in `news_cache` for 24 hours, and surfaced with per-user read/dismiss state. Refreshes are always explicit user actions — no background polling. The system gracefully degrades to cached articles when rate limits are hit.

---

## 2. What Was Built

### Architecture Overview

```
Browser → GET /api/news/portfolio  → newsQueryService → news_cache (DB)
         → GET /api/news/macro      → news_cache (DB)
         → POST /api/news/refresh    → newsService → Finnhub/FMP → news_cache (DB)
         → PATCH /api/news/articles/:id/state → user_article_state (DB)
```

### News Services (`lib/newsService.ts`, `lib/newsQueryService.ts`)

**`lib/newsService.ts`** — external API calls, parsing, deduplication:
- `fetchFinnhubNews(apiKey, tickers, isMacro)` — fetches from Finnhub, respects 429 rate limit
- `fetchFmpNews(apiKey, tickers)` — fetches from FMP, treats non-2xx as failure
- `parseFinnhubArticle(raw)` → `NewsArticle | null`
- `parseFmpArticle(raw)` → `NewsArticle | null`
- `deduplicateArticles(articles)` — O(n) Set-based dedup by `externalId`

**`lib/newsQueryService.ts`** — query-time filtering and ranking:
- `splitIntoTiers(articles, userTickers)` — Tier 1: direct ticker overlap; Tier 2: `metadata.related_tickers` overlap
- `mergeAndRankArticles(tier1, tier2)` — tier-1 articles first, deduplicated by id
- `paginateArticles(array, page, limit)` — 1-based page slicing

### Two-Tier Portfolio Filtering

**Tier 1 (higher priority):** Article's `tickers` array has at least one element in common with the user's holding tickers. Uses the GIN index on `news_cache.tickers` for fast array overlap queries.

**Tier 2 (lower priority):** Article is NOT in tier-1, but `news_cache.metadata.related_tickers` has overlap with user tickers. Enabled by migration 19 which added the `metadata JSONB` column.

### News Cache (`supabase/migrations/12_news_cache.sql` + `19_news_cache_metadata.sql`)

```sql
CREATE TABLE news_cache (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id  TEXT NOT NULL UNIQUE,
  source       TEXT NOT NULL,         -- 'finnhub' | 'fmp'
  tickers      TEXT[] NOT NULL,       -- GIN-indexed
  headline     TEXT NOT NULL,
  summary      TEXT,
  url          TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  is_macro     BOOLEAN NOT NULL DEFAULT FALSE,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- migration 19: ADD COLUMN metadata JSONB
-- Schema: { sector, related_tickers, related_terms, personnel }
```

**RLS:** `SELECT USING (TRUE)` — all authenticated users can read. Writes are service-role only.

**Purge:** `pg_cron` job (migration 18) runs daily at 02:00 UTC:
```sql
DELETE FROM news_cache WHERE fetched_at < NOW() - INTERVAL '24 hours'
```

### Per-User Article State (`supabase/migrations/13_user_article_state.sql`)

```sql
CREATE TABLE user_article_state (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id    UUID NOT NULL REFERENCES news_cache(id) ON DELETE CASCADE,
  is_read       BOOLEAN NOT NULL DEFAULT FALSE,
  is_dismissed  BOOLEAN NOT NULL DEFAULT FALSE,
  interacted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, article_id)
);
```

**RLS:** `article_state_owner USING (user_id = auth.uid())` — user B cannot see user A's state.

### API Routes

| Route | Method | What It Does |
|---|---|---|
| `/api/news/portfolio` | GET | Two-tier filtered news for user's holdings, paginated |
| `/api/news/macro` | GET | All `is_macro = TRUE` articles, paginated |
| `/api/news/refresh` | POST | Fetches from Finnhub + FMP, upserts to news_cache, 15-min rate-limit guard |
| `/api/news/articles/:id/state` | PATCH | Upserts read/dismiss state for current user |

### News Page UI (`app/(dashboard)/news/page.tsx`)

- **Two tabs:** Portfolio News, Macro News
- **RefreshBar:** "Last updated X" + Refresh button
- **ArticleCard list:** filters out `is_read` and `is_dismissed` articles
- **RateLimitBanner:** shown when Finnhub rate-limited or 15-min guard hit
- **Pagination:** Previous / Next (shown when `total > 20`)
- **Optimistic updates:** read/dismiss updates the UI immediately, rolls back on error

---

## 3. Stories

| Story | Sub-components |
|---|---|
| STORY-021 | `01-news_fetch_service.md`, `03-news_refresh_route.md`, `06-article_state_route.md`, `10-news_cache_table.md`, `11-user_article_state_table.md`, `12-news_purge_cron.md` |
| STORY-022 | `02-news_query_service.md`, `04-portfolio_news_route.md` |
| STORY-023 | `07-news_page_ui.md`, `08-article_card.md`, `09-rate_limit_banner.md` |
