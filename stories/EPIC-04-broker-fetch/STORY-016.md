# STORY-016 — Webull Sync & Settings Page Consolidation

## AGENT CONTEXT

**What this file is:** A user story specification for Webull API key encryption, holdings sync, and consolidating all five broker sections into a single Settings page with ExecutionModeNotice for non-Alpaca platforms. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F2-R7 (Webull platform — holdings fetch v1.0), F1-R9 (ExecutionModeNotice for non-Alpaca silos)
**Connected to:** `docs/architecture/02-database-schema.md` (user_profiles webull_* columns, holdings), `docs/architecture/03-api-contract.md` (profile PATCH, sync endpoint Webull branch), `docs/architecture/04-component-tree.md` (Settings page all broker sections, ExecutionModeNotice)
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-04 — Broker Fetch
**Phase:** 3
**Estimate:** 2 developer-days
**Status:** 🔲 Not started
**Depends on:** STORY-013, STORY-014, STORY-015
**Blocks:** Nothing

---

## User Story

As a Webull user, I can store my API credentials and sync holdings. As a developer, the Settings page now shows all six broker sections in a single consolidated view.

---

## Acceptance Criteria

1. `PATCH /api/profile` with `webull_key` and `webull_secret` encrypts and stores both.
2. `POST /api/silos/:id/sync` for a Webull silo fetches holdings.
3. Settings page shows all broker sections: Alpaca, BITKUB, InnovestX, Schwab OAuth, Webull. Webull section includes the note: "Webull requires a $500 minimum account value for API access." This is a **UI-only advisory notice** — it is not enforced by the backend. The sync endpoint does not validate account value; if the account value is below $500, Webull's own API will return an authentication or permissions error which the backend surfaces as `BROKER_UNAVAILABLE`.
4. Each section shows `ConnectionStatusDot` (green = connected, grey = not connected).
5. For all non-Alpaca platforms: the rebalancing wizard Step 2 shows `ExecutionModeNotice`: `"These orders will not be submitted automatically. After reviewing, you will execute them manually on [Platform Name]."` This banner is persistent and non-dismissible.
6. All API key inputs in Settings use `type="password"` with show/hide toggle. After save: masked with `••••••••`.

---

## Tasks

- [ ] Update profile PATCH: Webull key/secret encryption
- [ ] Update sync route: Webull branch
- [ ] Update Settings page with all 5 broker sections
- [ ] Add `ExecutionModeNotice` component to rebalancing wizard Step 2 (conditional on platform_type ≠ 'alpaca')
- [ ] Manual test: verify ExecutionModeNotice appears for BITKUB/InnovestX/Schwab/Webull silos
- [ ] Verify all key inputs masked after save

---

## Definition of Done

- [ ] All 6 acceptance criteria verified
- [ ] ExecutionModeNotice tested for each non-Alpaca platform type
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] `bd close <task-id> "STORY-016 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] Every page implemented in this story exports a `metadata` object or `generateMetadata` function following the format `[Page Name] | Rebalancify`
