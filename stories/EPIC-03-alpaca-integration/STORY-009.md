# STORY-009 — Alpaca Key Storage & Holdings Sync

## AGENT CONTEXT

**What this file is:** A user story specification for AES-256-GCM encryption of Alpaca API keys, storing them in user_profiles, and syncing live holdings from Alpaca into the holdings table. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F2-R7 (Alpaca platform integration), F1-R2 (API key security)
**Connected to:** `docs/architecture/02-database-schema.md` (user_profiles alpaca_* columns, holdings table), `docs/architecture/03-api-contract.md` (profile PATCH, sync endpoint), `docs/architecture/04-component-tree.md` (AlpacaLiveBadge, SyncButton, ConnectionStatusDot)
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-03 — Alpaca Integration
**Phase:** 2
**Estimate:** 2 developer-days
**Status:** 🔲 Not started
**Depends on:** STORY-007 (holdings write), STORY-005 (profile API)
**Blocks:** STORY-010

---

## User Story

As an Alpaca user, I can securely store my API key and secret in Settings, and sync my live holdings (positions + cash) from Alpaca into my Alpaca silo with one click.

---

## Acceptance Criteria

1. `PATCH /api/profile` with `alpaca_key` and `alpaca_secret` encrypts both using AES-256-GCM before storage. Returns `{ alpaca_connected: true }` — never returns the key or ciphertext.
2. Settings page: Alpaca section shows `ConnectionStatusDot` (green = connected). Inputs are `type="password"` with show/hide toggle. After save: inputs show `••••••••`.
3. `alpaca_mode` selector (paper | live) updates `user_profiles.alpaca_mode`.
4. When `alpaca_mode = 'live'`: `AlpacaLiveBadge` (amber LIVE) appears on the Alpaca silo card and in the Alpaca silo detail header.
5. `POST /api/silos/:id/sync` for an Alpaca silo: fetches positions from Alpaca API, upserts all holdings into the `holdings` table, updates `last_synced_at`.
6. Security test: Browser DevTools Network tab shows zero requests to `api.alpaca.markets` or `paper-api.alpaca.markets`. All traffic goes through `/api/silos/:id/sync`.
7. `SyncButton` in silo detail header triggers `POST /api/silos/:id/sync`. Shows spinner during in-flight. Shows `last_synced_at` timestamp after completion.
8. If Alpaca API is unreachable: `POST /api/silos/:id/sync` returns HTTP 503 with `BROKER_UNAVAILABLE`. UI shows `ErrorBanner` without crashing.
9. `POST /api/silos/:id/sync` on a manual silo returns HTTP 422 with `MANUAL_SILO_NO_SYNC`.

---

## Tasks

- [ ] Write `lib/encryption.ts` (AES-256-GCM encrypt/decrypt)
- [ ] Update `app/api/profile/route.ts` PATCH: encrypt Alpaca key/secret
- [ ] Write `app/api/silos/[silo_id]/sync/route.ts` (Alpaca positions fetch)
- [ ] Update Settings page: Alpaca section (key inputs, mode selector, status dot)
- [ ] Update SiloCard and SiloHeader: `AlpacaLiveBadge` (conditional)
- [ ] Write `components/shared/AlpacaLiveBadge.tsx`
- [ ] Unit tests: encryption round trip, IV uniqueness, wrong key throws
- [ ] Manual security test: zero browser requests to alpaca.markets

---

## Definition of Done

- [ ] All 9 acceptance criteria verified
- [ ] Encryption unit tests (3 tests per spec in testing strategy)
- [ ] Security test documented (network tab screenshot or test log)
- [ ] Key never returned in any API response (grep: no `alpaca_key` or `_enc` in any GET response body)
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] `bd close <task-id> "STORY-009 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] Every page implemented in this story exports a `metadata` object or `generateMetadata` function following the format `[Page Name] | Rebalancify`
