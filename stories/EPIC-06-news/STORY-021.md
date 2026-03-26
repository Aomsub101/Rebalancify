# STORY-021 — News Fetch Service & Cache

## AGENT CONTEXT

**What this file is:** A user story specification for the global news fetch service — Finnhub + FMP ingestion, deduplication, rate-limit guard, and pg_cron purge job. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F4-R1 (data sources), F4-R4 (global cache architecture), F4-R5 (user-triggered refresh only)
**Connected to:** `docs/architecture/02-database-schema.md` (news_cache, user_article_state tables), `docs/architecture/03-api-contract.md` (news refresh and state endpoints), `docs/prd/features/F4-news-feed.md`
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-06 — News Feed
**Phase:** 5
**Estimate:** 2 developer-days
**Status:** 🔲 Not started
**Depends on:** STORY-001 (news_cache, user_article_state tables)
**Blocks:** STORY-022, STORY-023

---

## User Story

As a developer, I need a news fetching service that populates the global `news_cache` from Finnhub and FMP, handles rate limits gracefully, and purges stale articles daily.

---

## Acceptance Criteria

1. `POST /api/news/refresh` fetches news from Finnhub and FMP, deduplicates by `external_id`, upserts into `news_cache`.
2. Rate limit handling: if Finnhub returns 429, stop calling Finnhub for that batch. Return whatever was cached.
3. `PATCH /api/news/articles/:id/state` writes `is_read` or `is_dismissed` to `user_article_state`.
4. A `pg_cron` job runs daily at 02:00 UTC to DELETE rows from `news_cache` where `fetched_at < NOW() - INTERVAL '24 hours'`.
5. **Refresh rate-limit guard:** Two calls to `POST /api/news/refresh` within 15 minutes of each other: the second call returns the already-cached articles and makes zero external API calls. This is a rate-limit guard on the refresh endpoint — it is NOT the cache TTL. `news_cache` rows have a 24-hour database retention (purged by `pg_cron`). Implement by checking `MAX(fetched_at) FROM news_cache WHERE fetched_at > NOW() - INTERVAL '15 minutes'` before calling Finnhub/FMP.
6. If both Finnhub and FMP are unavailable: returns last cached articles with original `fetched_at`.

---

## Tasks

- [ ] Write news fetch service (Finnhub + FMP, upsert `news_cache`)
- [ ] Write `app/api/news/refresh/route.ts`
- [ ] Write `app/api/news/articles/[article_id]/state/route.ts`
- [ ] Write `pg_cron` purge job SQL
- [ ] Test: rate limit scenario (mock 429 → returns cache)
- [ ] Test: dual unavailability → returns last cache

---

## Definition of Done

- [ ] All 6 acceptance criteria verified
- [ ] Cache-hit test (zero external calls on second refresh within 15 min)
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] `bd close <task-id> "STORY-021 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
