# STORY-025 — Top Movers Dashboard

## AGENT CONTEXT

**What this file is:** A user story specification for the top movers endpoint — top 5 gainers + top 5 losers for US stocks (Finnhub/FMP) and crypto (CoinGecko) with stale-cache fallback. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F5-R3 (top movers data)
**Connected to:** `docs/architecture/02-database-schema.md` (price_cache — read), `docs/architecture/03-api-contract.md` (top-movers endpoint), `docs/architecture/04-component-tree.md` (TopMoversTable)
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-07 — Discovery
**Phase:** 6
**Estimate:** 1 developer-day
**Status:** 🔲 Not started
**Depends on:** STORY-007 (price service)
**Blocks:** STORY-026

---

## User Story

As a user, I can see the top 5 gainers and top 5 losers for US stocks and crypto, with last-cached fallback on source unavailability.

---

## Acceptance Criteria

1. `GET /api/market/top-movers?type=stocks` returns top 5 gainers + top 5 losers for US stocks (Finnhub or FMP).
2. `GET /api/market/top-movers?type=crypto` returns top 5 gainers + top 5 losers (CoinGecko, no API key required).
3. Each item: ticker, name, current price, daily % change.
4. If source unavailable: returns last cached data with stale timestamp. No error screen.
5. Percentage changes shown with sign and colour: green for gainers, red for losers, with icon (non-colour signal).

---

## Tasks

- [ ] Write `app/api/market/top-movers/route.ts`
- [ ] Test: unavailability → fallback to cache
- [ ] Test: colour + icon on gainer/loser cells

---

## Definition of Done

- [ ] All 5 acceptance criteria verified
- [ ] Colour + icon test: verify both present (non-colour signal requirement)
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] `bd close <task-id> "STORY-025 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
