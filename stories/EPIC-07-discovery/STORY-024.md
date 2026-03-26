# STORY-024 — Asset Peer Discovery

## AGENT CONTEXT

**What this file is:** A user story specification for the peer assets endpoint — Finnhub stock/peers data with a static sector_taxonomy.json fallback. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F5-R1 (peer asset discovery), F5-R2 (static fallback)
**Connected to:** `docs/architecture/02-database-schema.md` (assets, price_cache — read only), `docs/architecture/03-api-contract.md` (peers endpoint), `docs/architecture/04-component-tree.md` (PeerCard)
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-07 — Discovery
**Phase:** 6
**Estimate:** 1 developer-day
**Status:** 🔲 Not started
**Depends on:** STORY-006 (assets table), STORY-007 (holdings)
**Blocks:** STORY-026

---

## User Story

As a user, I can search for any ticker and see 5–8 related peer assets, using Finnhub's peer data with an offline static fallback.

---

## Acceptance Criteria

1. `GET /api/assets/:id/peers` returns 5–8 peer assets from Finnhub `/stock/peers`.
2. If Finnhub is unavailable: returns from `sector_taxonomy.json` static file. No error shown to user.
3. Each peer includes: ticker, name, current price from `price_cache`.
4. `AiInsightTag` field is NOT included in v1.0 response (even if llm_connected = true).
5. RLS: any authenticated user can call this endpoint (peer data is global).

---

## Tasks

- [ ] Write `app/api/assets/[asset_id]/peers/route.ts`
- [ ] Write `sector_taxonomy.json` (50+ major stocks across 8 sectors)
- [ ] Test: Finnhub unavailable → returns static fallback, no error UI

---

## Definition of Done

- [ ] All 5 acceptance criteria verified
- [ ] Static fallback tested
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] `bd close <task-id> "STORY-024 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
