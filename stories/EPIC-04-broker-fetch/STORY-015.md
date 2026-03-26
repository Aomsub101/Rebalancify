# STORY-015 — Charles Schwab OAuth & Holdings Sync

## AGENT CONTEXT

**What this file is:** A user story specification for Charles Schwab OAuth 2.0 flow, token storage (encrypted), 7-day token expiry handling, and holdings sync. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F2-R7 (Schwab platform — holdings fetch v1.0, OAuth flow)
**Connected to:** `docs/architecture/02-database-schema.md` (user_profiles schwab_* columns), `docs/architecture/03-api-contract.md` (OAuth routes, sync endpoint Schwab branch), `docs/architecture/04-component-tree.md` (TokenExpiryWarning, ConnectionStatusDot)
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.
- ⚠️ **HUMAN PREREQUISITE:** This story cannot be end-to-end tested without an approved Schwab developer app (Client ID + Client Secret). Schwab's approval process takes 1–4 weeks. Confirm the developer app was registered at project start. If approval is pending, skip to STORY-016 and return here when the credentials arrive.

---

**Epic:** EPIC-04 — Broker Fetch
**Phase:** 3
**Estimate:** 3 developer-days (maximum per-story limit reached — this story must be split before implementation begins; see splitting guidance added to Notes section below)
**Status:** 🔲 Not started
**Depends on:** STORY-009
**Blocks:** STORY-016

---

## User Story

As a Schwab user, I can connect my account via OAuth, sync holdings, and re-authenticate when my token expires.

---

## Acceptance Criteria

1. "Connect Schwab" button in Settings initiates the OAuth flow (redirect to Schwab authorization URL).
2. OAuth callback exchanges the code for access + refresh tokens. Both are encrypted and stored in `user_profiles`.
3. `schwab_token_expires` is set correctly from the token response.
4. `GET /api/profile` returns `{ schwab_connected: true, schwab_token_expired: false }` when token is valid.
5. When `schwab_token_expires < NOW()`: `GET /api/profile` returns `schwab_token_expired: true`. Settings shows `TokenExpiryWarning` banner.
6. `POST /api/silos/:id/sync` for a Schwab silo: if token is expired, returns HTTP 401 with `SCHWAB_TOKEN_EXPIRED`. UI shows error prompting re-authentication.
7. If token is valid, sync fetches account positions and upserts holdings.
8. Security: zero browser requests to Schwab API endpoints.

---

## Tasks

- [ ] Write OAuth connect endpoint: `app/api/auth/schwab/route.ts`
- [ ] Write OAuth callback: `app/api/auth/schwab/callback/route.ts`
- [ ] Encrypt + store access/refresh tokens
- [ ] Update sync route: Schwab branch + token expiry check
- [ ] Update Settings: Schwab OAuth section (connect button, expiry warning)
- [ ] Security test

---

## Definition of Done

- [ ] All 8 acceptance criteria verified
- [ ] Token expiry path tested (manually set `schwab_token_expires` to past)
- [ ] `bd close <task-id> "STORY-015 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file

---

- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file

---

## Notes

This story exceeds the 3-developer-day maximum and must be split into two stories before implementation:

- **STORY-015a:** OAuth flow — `app/api/auth/schwab/route.ts`, callback, token encryption, token expiry detection
- **STORY-015b:** Sync endpoint — positions fetch, holdings upsert, Settings UI Schwab section, token-expired error handling

Create `STORY-015b.md` as a sibling file in `EPIC-04-broker-fetch/` before starting STORY-015a. Add both to `stories/epics.md` and `PROGRESS.md`.
