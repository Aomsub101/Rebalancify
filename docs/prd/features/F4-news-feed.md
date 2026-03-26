# docs/prd/features/F4-news-feed.md — Feature 4: Contextual News Feed

## AGENT CONTEXT

**What this file is:** Requirements for the two-tab news feed (Portfolio News + Macro News).
**Derived from:** PRD_v1.3.md Section 6 Feature 4, FEATURES_v1.3.txt Feature 4
**Connected to:** docs/architecture/02-database-schema.md (news_cache, user_article_state), docs/architecture/03-api-contract.md (Section 10 News Endpoints), docs/architecture/04-component-tree.md (Section 2.6 News Page), stories/EPIC-06-news/
**Critical rules for agents using this file:**
- F4-R5: No background auto-refresh. Every refresh must be user-triggered.
- F4-R7: Rate limit degradation must show last cached data — never an error screen with no content.
- The global news cache is shared across all users. Per-user read/dismiss state is separate.

---

## Feature Purpose

A two-tab news surface (Portfolio News and Macro News) sourced from Finnhub and FMP. All refreshes are user-triggered. Articles are cached globally with a per-user read/dismiss state layer. Graceful degradation when rate limits are reached.

---

## Requirements

### F4-R1 — Data Sources

News data sourced from Finnhub and Financial Modeling Prep (FMP) free-tier API endpoints. The application must function within the rate limits of both free tiers:

| Source | Free Limit | Used For |
|---|---|---|
| Finnhub | 60 calls/min | Portfolio news, company profiles for tag enrichment |
| FMP | 250 calls/day | News fallback, macro news |

**Failure mode:** If both sources are unavailable, show cached data with stale timestamp. If no cached data exists, show `EmptyState` with a message directing the user to check their internet connection.

---

### F4-R2 — Two-Tab Structure

The news UI is divided into two distinct tabs:

- **Portfolio News:** Articles filtered and ranked by relevance to the user's current holdings across all silos.
- **Macro News:** General market and macroeconomic news not filtered by holdings.

Both tabs share the same `RefreshBar` and `RateLimitBanner` components.

---

### F4-R3 — Portfolio News Filtering (Two-Tier Matching)

Portfolio News filtering uses a two-tier matching algorithm, run on every refresh:

- **Tier 1:** Exact match on ticker symbol (`news_cache.tickers @> ARRAY[$ticker]`) and full company name match.
- **Tier 2:** Enriched tag matching using company profile data fetched from Finnhub's company profile endpoint — sector, related terms, key personnel. Enrichment tags stored in `metadata` JSONB of `news_cache`.

Articles matched by both tiers are deduplicated. Tier 1 matches are ranked above Tier 2.

---

### F4-R4 — Global Cache + Per-User State

Articles are cached globally in `news_cache` (one record per article, shared across all users) with a **24-hour retention period**. Rows older than 24 hours are purged by a `pg_cron` job running daily at 02:00 UTC. The 15-minute window described in F4-R5 is a **rate-limit guard** on the refresh endpoint — it prevents calling external APIs again within 15 minutes of the last refresh. These are two different concepts: the 15-minute guard limits external API calls; the 24-hour retention controls how long articles remain in the DB. See `docs/architecture/02-database-schema.md` `news_cache` section for the authoritative definition. Each user's read and dismissed state is stored separately in `user_article_state` and linked to the global cache records.

**Architecture benefit:** Minimises API quota usage. A Finnhub call for AAPL news populates the cache for all users who hold AAPL.

**Implementation constraint:** `POST /news/refresh` writes to `news_cache` (global). `PATCH /news/articles/:id/state` writes to `user_article_state` (user-scoped). These are separate operations and separate tables.

---

### F4-R5 — User-Triggered Refresh Only

News refresh is exclusively user-triggered. A visible `RefreshBar` component shows "Last updated [relative time]" and a Refresh button. Background auto-refresh is not permitted.

**Implementation constraint:** There must be no `setInterval` or `setTimeout` for news refreshing. React Query must not have `refetchInterval` set for news queries.

**UX:** Refresh runs asynchronously — other UI elements on the page must remain interactive during the refresh. The Refresh button shows a loading spinner while in progress.

---

### F4-R6 — Refresh Latency

News feed response time (from user triggering refresh to articles rendered) must be under 3 seconds under normal network conditions.

---

### F4-R7 — Rate Limit Degradation

When a rate limit is reached on either Finnhub or FMP, the feed must:
1. Display the most recently cached articles (not an error screen).
2. Show a visible `RateLimitBanner` component: `"Rate limit reached — showing articles last updated [timestamp]."` The banner includes a direct link to the article source.
3. The Refresh button is disabled during the rate-limit cooldown period, with a tooltip showing the cooldown time.
