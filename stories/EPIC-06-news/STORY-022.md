# STORY-022 — Portfolio News & Macro News Endpoints

## AGENT CONTEXT

**What this file is:** A user story specification for the two news query endpoints — portfolio news (two-tier ticker matching) and macro news — with per-user read/dismiss state. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F4-R2 (two-tab structure), F4-R3 (portfolio news two-tier matching)
**Connected to:** `docs/architecture/02-database-schema.md` (news_cache GIN index on tickers, user_article_state), `docs/architecture/03-api-contract.md` (portfolio and macro news endpoints), `docs/prd/features/F4-news-feed.md`
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-06 — News Feed
**Phase:** 5
**Estimate:** 1 developer-day
**Status:** 🔲 Not started
**Depends on:** STORY-021
**Blocks:** STORY-023

---

## User Story

As a user, portfolio news shows articles relevant to my holdings, and macro news shows general market articles.

---

## Acceptance Criteria

1. `GET /api/news/portfolio` returns articles where `tickers && [user's holding tickers]` (GIN index). Tier 1 + Tier 2 matching. Deduplicated. Ranked by Tier 1 first.
2. `GET /api/news/macro` returns `is_macro = TRUE` articles.
3. Both endpoints include `is_read` and `is_dismissed` state from `user_article_state`.
4. Pagination: `?page=1&limit=20`.
5. RLS: user B cannot see user A's `user_article_state`.

---

## Tasks

- [ ] Write `app/api/news/portfolio/route.ts` (two-tier matching)
- [ ] Write `app/api/news/macro/route.ts`
- [ ] Test: portfolio news returns only articles matching user's tickers
- [ ] RLS test for `user_article_state`

---

## Definition of Done

- [ ] All 5 acceptance criteria verified
- [ ] Tier 1 articles ranked above Tier 2
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] `bd close <task-id> "STORY-022 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
