# STORY-023 — News Page UI

## AGENT CONTEXT

**What this file is:** A user story specification for the News page UI — tabbed interface, RefreshBar, ArticleList with read/dismiss controls, and RateLimitBanner. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F4-R2 (two-tab structure), F4-R5 (user-triggered refresh), F4-R6 (refresh latency), F4-R7 (rate limit degradation)
**Connected to:** `docs/architecture/04-component-tree.md` (NewsTabs, RefreshBar, ArticleList, ArticleCard, RateLimitBanner), `docs/design/CLAUDE_FRONTEND.md` (no setInterval rule), `docs/design/03-screen-flows.md` (News Page layout)
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-06 — News Feed
**Phase:** 5
**Estimate:** 1 developer-day
**Status:** 🔲 Not started
**Depends on:** STORY-022
**Blocks:** Nothing

---

## User Story

As a user, I can browse portfolio news and macro news in a tabbed interface, manually refresh, and mark articles as read or dismissed.

---

## Acceptance Criteria

1. News page: `NewsTabs` (Portfolio News | Macro News), `RefreshBar` (last updated + Refresh button), `ArticleList`.
2. No background auto-refresh. Verified: no `setInterval` in news components.
3. `RateLimitBanner` (amber, collapsible) appears when rate limit is hit.
4. `ArticleCard` shows: headline, ticker chips, source, relative timestamp, external link.
5. Read/dismiss controls appear on hover. PATCH updates `user_article_state` and removes the article from the active list (optimistic update).
6. `EmptyState` when no articles match portfolio.

---

## Tasks

- [ ] Write `app/(dashboard)/news/page.tsx`
- [ ] Write `components/news/ArticleCard.tsx`
- [ ] Write `components/news/RateLimitBanner.tsx`
- [ ] Verify: grep for `setInterval` in news components → zero results

---

## Definition of Done

- [ ] All 6 acceptance criteria verified
- [ ] No setInterval in news code
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] `bd close <task-id> "STORY-023 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] Every page implemented in this story exports a `metadata` object or `generateMetadata` function following the format `[Page Name] | Rebalancify`
