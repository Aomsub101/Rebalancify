# Component 06 — News Feed: Implementation Plan

## Overview

User-triggered personalised news surface: portfolio-specific articles (filtered by held tickers) and macro financial news. Fetched from Finnhub + FMP, cached in news_cache for 24h, with per-user read/dismiss state. Graceful degradation on rate limits.

## Dependencies

- **Component 01:** Auth Foundation (middleware, Supabase clients, AppShell)
- **Component 02:** Portfolio Data Layer (user's ticker list from holdings)
- **Component 05:** Market Data & Pricing (news uses same Finnhub API key)

## Architecture Reference

- `docs/architecture/components/06_news_feed/`

---

## Sprint 1 — News Services & Cache

**Goal:** News fetch service, query service, cache table, purge cron.

| Task | File | Summary |
|------|------|---------|
| TS.1.1 | `sprint1/TS.1.1_news_fetch_service.md` | lib/newsService.ts — Finnhub + FMP fetch, parse, dedup |
| TS.1.2 | `sprint1/TS.1.2_news_query_service.md` | lib/newsQueryService.ts — two-tier filtering, ranking |
| TS.1.3 | `sprint1/TS.1.3_news_cache_migration.md` | news_cache table + GIN index + metadata column |
| TS.1.4 | `sprint1/TS.1.4_news_purge_cron.md` | pg_cron job: purge news_cache > 24h daily at 02:00 UTC |

---

## Sprint 2 — API Routes

**Goal:** Portfolio news, macro news, refresh, article state endpoints.

| Task | File | Summary |
|------|------|---------|
| TS.2.1 | `sprint2/TS.2.1_portfolio_news_route.md` | GET /api/news/portfolio (two-tier ticker matching) |
| TS.2.2 | `sprint2/TS.2.2_macro_news_route.md` | GET /api/news/macro |
| TS.2.3 | `sprint2/TS.2.3_news_refresh_route.md` | POST /api/news/refresh (manual re-fetch, 15-min guard) |
| TS.2.4 | `sprint2/TS.2.4_article_state_route.md` | PATCH /api/news/articles/:id/state (read/dismiss) |

---

## Sprint 3 — News Page UI

**Goal:** Full news page with tabs, article cards, refresh, rate limit banner.

| Task | File | Summary |
|------|------|---------|
| TS.3.1 | `sprint3/TS.3.1_news_page.md` | NewsPage: tabs, RefreshBar, pagination |
| TS.3.2 | `sprint3/TS.3.2_article_card.md` | ArticleCard: headline, ticker tags, read/dismiss controls |
| TS.3.3 | `sprint3/TS.3.3_rate_limit_banner.md` | RateLimitBanner (amber, collapsible) |

---

## Sprint 4 — Testing

**Goal:** Unit, integration, and E2E tests.

| Task | File | Summary |
|------|------|---------|
| TS.4.1 | `sprint4/TS.4.1_unit_tests.md` | Unit: dedup, two-tier filtering, pagination |
| TS.4.2 | `sprint4/TS.4.2_integration_tests.md` | Integration: fetch → cache → query flow |
| TS.4.3 | `sprint4/TS.4.3_e2e_tests.md` | E2E: refresh → read article → dismiss → pagination |
