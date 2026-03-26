# STORY-015b — Schwab Holdings Sync & Settings UI

## AGENT CONTEXT

**What this file is:** A user story specification for Charles Schwab holdings sync (after OAuth tokens are stored by STORY-015) and the Settings UI Schwab section with token expiry warning. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F2-R7 (Schwab platform — holdings fetch v1.0)
**Connected to:** `docs/architecture/02-database-schema.md` (user_profiles schwab_* token columns), `docs/architecture/03-api-contract.md` (sync endpoint Schwab branch), `docs/architecture/04-component-tree.md` (TokenExpiryWarning, ConnectionStatusDot)
**Critical rules for agents using this file:**
- Do not start implementation until STORY-015 is marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-04 — Broker Fetch
**Phase:** 3
**Estimate:** 2 developer-days
**Status:** 🔲 Not started
**Depends on:** STORY-015 (Schwab OAuth flow and token storage)
**Blocks:** STORY-016

---

## User Story

As a Schwab user with a valid OAuth token, I can sync my holdings, and I am clearly notified when my token expires so I can re-authenticate.

---

## Acceptance Criteria

> **Note:** AC items in this story include a proactive Schwab token expiry notification. This is implemented inside the Vercel Cron Job (STORY-020) — the acceptance criteria below define what the cron job must produce and how the UI must respond. Implement the cron job check in STORY-020 and verify the UI behaviour here.

1. `POST /api/silos/:id/sync` for a Schwab silo: if token is expired, returns HTTP 401 with `SCHWAB_TOKEN_EXPIRED`. UI shows error prompting re-authentication.
2. If token is valid, sync fetches account positions and upserts holdings into `holdings` with `source = 'schwab_sync'`.
3. `last_synced_at` is updated after a successful sync.
4. Settings page Schwab section: shows `ConnectionStatusDot` and `TokenExpiryWarning` banner when `schwab_token_expired: true`.
5. `GET /api/profile` returns `{ schwab_connected: true, schwab_token_expired: false }` when token is valid.
6. Proactive expiry alert: when `schwab_token_expires < NOW() + INTERVAL '2 days'`, the Vercel Cron Job inserts a `'schwab_token_expiring'` notification row. The `NotificationBell` in the TopBar shows a badge count. Clicking the bell shows: "Your Schwab connection expires in [N] days — reconnect in Settings."
7. Security: zero browser requests to Schwab API endpoints.

---

## Tasks

- [ ] Update `app/api/silos/[silo_id]/sync/route.ts`: Schwab branch with token expiry check
- [ ] Update Settings page: Schwab section (status dot, expiry warning)
- [ ] Test: token expiry path (manually set `schwab_token_expires` to past date)
- [ ] Security test

---

## Definition of Done

- [ ] All 6 acceptance criteria verified
- [ ] Token expiry path tested
- [ ] Security test documented
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] `bd close <task-id> "STORY-015b complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
