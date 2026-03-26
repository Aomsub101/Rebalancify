# STORY-013 — BITKUB Holdings Sync

## AGENT CONTEXT

**What this file is:** A user story specification for BITKUB API key encryption, wallet balance sync, and price cache update from BITKUB market ticker data. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F2-R7 (BITKUB platform — holdings fetch v1.0)
**Connected to:** `docs/architecture/02-database-schema.md` (user_profiles bitkub_* columns, holdings, price_cache), `docs/architecture/03-api-contract.md` (profile PATCH, sync endpoint BITKUB branch), `docs/architecture/04-component-tree.md` (ConnectionStatusDot, SyncButton)
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-04 — Broker Fetch
**Phase:** 3
**Estimate:** 2 developer-days
**Status:** 🔲 Not started
**Depends on:** STORY-009 (encryption pattern established)
**Blocks:** STORY-016 (settings page consolidation)

---

## User Story

As a BITKUB user, I can store my API credentials in Settings and sync my crypto wallet holdings and current prices into my BITKUB silo.

---

## Acceptance Criteria

1. `PATCH /api/profile` with `bitkub_key` and `bitkub_secret` encrypts and stores both. Returns `{ bitkub_connected: true }`.
2. `POST /api/silos/:id/sync` for a BITKUB silo fetches wallet balances from BITKUB's authenticated API and upserts holdings.
3. Price cache is updated from BITKUB's `/api/market/ticker` response during sync (avoids a second API call for the same data).
4. `last_synced_at` is updated after a successful sync.
5. Security: zero browser requests to BITKUB API endpoints. All calls through `/api/silos/:id/sync`.
6. If BITKUB API is unreachable: HTTP 503 `BROKER_UNAVAILABLE`. UI shows `ErrorBanner`.
7. BITKUB silo has `ExecutionModeTag: MANUAL` (no automated execution in v1.0).

---

## Tasks

- [ ] Update `app/api/profile/route.ts`: BITKUB key/secret encryption
- [ ] Update `app/api/silos/[silo_id]/sync/route.ts`: BITKUB branch
- [ ] Security test: zero browser requests to BITKUB endpoints
- [ ] Manual test: sync with real BITKUB paper/test account (or mock)

---

## Definition of Done

- [ ] All 7 acceptance criteria verified
- [ ] Security test documented
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] `bd close <task-id> "STORY-013 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
