# STORY-014b — InnovestX Digital Asset Branch & Settings UI

## AGENT CONTEXT

**What this file is:** A user story specification for the InnovestX digital asset sync branch (HMAC-SHA256) and the dual-section Settings UI for both Settrade equity and digital asset credentials. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F2-R7 (InnovestX digital asset branch)
**Connected to:** `docs/architecture/02-database-schema.md` (user_profiles innovestx_digital_* columns), `docs/architecture/03-api-contract.md` (sync endpoint digital asset branch), `docs/architecture/04-component-tree.md` (dual InnovestX Settings sections)
**Critical rules for agents using this file:**
- Do not start implementation until STORY-014 is marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.
- ⚠️ **HUMAN PREREQUISITE:** The InnovestX Digital Asset API Key and Secret are not self-service. A human must contact InnovestX support to obtain these credentials before this story can be end-to-end tested. If credentials are unavailable, implementation can proceed but the sync cannot be verified. See `docs/prd/06-platform-support.md` InnovestX section for details.

---

**Epic:** EPIC-04 — Broker Fetch
**Phase:** 3
**Estimate:** 2 developer-days
**Status:** 🔲 Not started
**Depends on:** STORY-014 (Settrade equity branch)
**Blocks:** STORY-016

---

## User Story

As an InnovestX user with digital assets, I can store my digital asset credentials and sync my digital asset holdings. The Settings page shows both credential sections with independent connection status indicators.

---

## Acceptance Criteria

1. `PATCH /api/profile` with `innovestx_digital_key` and `innovestx_digital_secret` encrypts and stores both.
2. `GET /api/profile` returns `{ innovestx_digital_connected: bool }`.
3. `POST /api/silos/:id/sync` InnovestX digital asset branch: decrypt credentials → build HMAC-SHA256 signature → call balance endpoint → upsert holdings with `source = 'innovestx_sync'`.
4. Prices for digital asset holdings fetched via CoinGecko (Tier 3) and cached in `price_cache`.
5. If digital key is missing, sync returns partial result with only equity assets (no crash). `sync_warnings` field describes the skipped sub-account.
6. Settings page: two distinct InnovestX credential sections — one for Settrade equity, one for Digital Asset. Each with independent `ConnectionStatusDot`.
7. Security: zero browser requests to InnovestX API endpoints.
8. InnovestX silo displays `ExecutionModeTag: MANUAL`.

---

## Tasks

- [ ] Update `app/api/profile/route.ts` PATCH: InnovestX digital asset key/secret encryption
- [ ] Update `app/api/silos/[silo_id]/sync/route.ts`: InnovestX digital asset branch (HMAC-SHA256)
- [ ] Update Settings page: add Digital Asset section to InnovestX card
- [ ] HMAC-SHA256 signature test against InnovestX API docs test vectors
- [ ] Security test: zero browser requests to InnovestX endpoints

---

## Definition of Done

- [ ] All 8 acceptance criteria verified
- [ ] Both sync branches tested independently (equity-only, digital-only, both, neither)
- [ ] HMAC-SHA256 signature generation tested
- [ ] Security test passed
- [ ] RLS isolation verified
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] `bd close <task-id> "STORY-014b complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
