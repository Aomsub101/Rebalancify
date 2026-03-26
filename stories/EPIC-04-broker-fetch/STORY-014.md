# STORY-014 — InnovestX Holdings Sync

## AGENT CONTEXT

**What this file is:** A user story specification for InnovestX dual-sub-account sync — Settrade equity (OAuth) and InnovestX digital assets (HMAC-SHA256). Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F2-R7 (InnovestX platform — holdings fetch v1.0, dual-API architecture)
**Connected to:** `docs/architecture/02-database-schema.md` (user_profiles innovestx_* columns, holdings, price_cache), `docs/architecture/03-api-contract.md` (profile PATCH, sync endpoint InnovestX branch), `docs/architecture/04-component-tree.md` (dual Settings sections)
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-04 — Broker Fetch
**Phase:** 3
**Estimate:** 3 developer-days (maximum per-story limit reached — this story must be split before implementation begins; see splitting guidance added to Notes section below)
**Status:** 🔲 Not started
**Depends on:** STORY-009 (key encryption pattern from Alpaca)
**Blocks:** STORY-016

---

## User Story

As an InnovestX user, I can store my Settrade equity credentials and my InnovestX digital asset credentials separately, and sync both my Thai equity holdings and my digital asset holdings into my InnovestX silo.

---

## Background

InnovestX exposes two completely separate APIs with different authentication mechanisms:

1. **Settrade Open API** (equities) — OAuth Bearer token via App ID + App Secret. Documentation: https://developer.settrade.com/
2. **InnovestX Digital Asset API** (crypto/digital assets) — HMAC-SHA256 signatures using `X-INVX-SIGNATURE`, `X-INVX-TIMESTAMP`, `X-INVX-REQUEST-UID` headers. Documentation: https://api-docs.innovestxonline.com/

Both APIs must work for the InnovestX silo to display complete holdings. Each has its own credential pair, its own error states, and its own sync logic. They must be implemented as separate branches within the sync route.

---

## Acceptance Criteria

1. `PATCH /api/profile` with `innovestx_key` and `innovestx_secret` (Settrade equity credentials) encrypts and stores both in `user_profiles.innovestx_key_enc` and `user_profiles.innovestx_secret_enc`.
2. `PATCH /api/profile` with `innovestx_digital_key` and `innovestx_digital_secret` encrypts and stores both in `user_profiles.innovestx_digital_key_enc` and `user_profiles.innovestx_digital_secret_enc`.
3. `GET /api/profile` returns `{ innovestx_equity_connected: bool, innovestx_digital_connected: bool }` — one boolean per sub-account, derived from whether the respective encrypted columns are non-null.
4. Settings page shows two distinct credential sections for InnovestX: one for Settrade equity credentials, one for Digital Asset credentials. Each section has its own connection status indicator.
5. `POST /api/silos/:id/sync` for an InnovestX silo triggers both sync branches in sequence:
   - **Equity branch:** Fetches Thai stock portfolio via Settrade SDK `get_portfolio(account_no)`. Upserts holdings with `source = 'innovestx_sync'`.
   - **Digital Asset branch:** Fetches digital asset balances via InnovestX proprietary endpoint. Upserts holdings with `source = 'innovestx_sync'`.
   - Each branch handles its own auth failure independently — if only the digital key is missing, the equity sync still succeeds.
6. Prices for Thai equity holdings are fetched via Finnhub (fallback tier) and cached in `price_cache`.
7. Prices for digital asset holdings are fetched via CoinGecko (Tier 3) and cached in `price_cache`.
8. `last_synced_at` is updated on `silos` after both branches complete (or the successful branch, if one fails).
9. If the equity sub-account credentials are missing, the sync returns a partial result with only digital assets (and vice versa). A `sync_warnings` field in the response describes which sub-account was skipped.
10. Security: zero browser requests to Settrade or InnovestX API endpoints.
11. InnovestX silo displays `ExecutionModeTag: MANUAL`.

---

## Technical Context

**Database tables used:**
- `user_profiles` — `innovestx_key_enc`, `innovestx_secret_enc`, `innovestx_digital_key_enc`, `innovestx_digital_secret_enc` — see `docs/architecture/02-database-schema.md`
- `holdings` — upsert with `source = 'innovestx_sync'` — see schema doc
- `price_cache` — upsert prices after sync — see schema doc

**API endpoints implemented:**
- `PATCH /api/profile` — extended for two InnovestX credential pairs — see `docs/architecture/03-api-contract.md`
- `POST /api/silos/:id/sync` — InnovestX branch (dual-sub-account logic) — see API contract

**External services:**
- Settrade Open API — `get_portfolio(account_no)` — failure: skip equity branch, log warning
- InnovestX Digital Asset API — proprietary balance endpoint — failure: skip digital branch, log warning
- Finnhub `/quote` — Thai equity prices — failure: use stale `price_cache` if available
- CoinGecko `/simple/price` — digital asset prices — failure: use stale `price_cache` if available

---

## Implementation Tasks

1. **Schema verification** — Confirm `user_profiles` has all four InnovestX encrypted columns (`innovestx_key_enc`, `innovestx_secret_enc`, `innovestx_digital_key_enc`, `innovestx_digital_secret_enc`). If running migrations from scratch, the STORY-001 migration already includes them. If patching an existing DB, write an additive migration.

2. **Profile PATCH — equity credentials** — Extend `app/api/profile/route.ts` PATCH handler: if `innovestx_key` and/or `innovestx_secret` are present in the request body, encrypt and store them using the AES-256-GCM pattern from STORY-009.

3. **Profile PATCH — digital asset credentials** — Same handler: if `innovestx_digital_key` and/or `innovestx_digital_secret` are present, encrypt and store them in the two new columns.

4. **Profile GET — dual connection booleans** — Update `GET /api/profile` response to return `innovestx_equity_connected` and `innovestx_digital_connected` as separate booleans.

5. **Sync route — Settrade equity branch** — In `app/api/silos/[silo_id]/sync/route.ts`, add the InnovestX equity branch: decrypt Settrade credentials → authenticate via OAuth Bearer → call `get_portfolio(account_no)` → upsert holdings.

6. **Sync route — InnovestX digital asset branch** — Add the digital asset branch: decrypt digital asset credentials → build HMAC-SHA256 signature (`X-INVX-SIGNATURE`, `X-INVX-TIMESTAMP`, `X-INVX-REQUEST-UID`) → call balance endpoint → upsert holdings.

7. **Price caching for both sub-accounts** — After each sync branch, invoke `priceService` for any asset whose price is stale: Finnhub for Thai equities, CoinGecko for digital assets.

8. **Settings page — dual sections** — Add two distinct credential input sections to the Settings page InnovestX card: one for Settrade equity (App ID + App Secret), one for Digital Asset (Key + Secret). Each with masked `type="password"` inputs, show/hide toggle, and independent connection status badge.

9. **Security test** — Network inspection must show zero requests from the browser to `settrade.com` or `innovestxonline.com` endpoints.

---

## Definition of Done

- [ ] All 11 acceptance criteria verified
- [ ] Both sync branches tested independently (equity-only, digital-only, both, neither)
- [ ] HMAC-SHA256 signature generation tested against InnovestX API docs test vectors
- [ ] Security test passed (no browser requests to external InnovestX endpoints)
- [ ] RLS isolation verified: InnovestX holdings not readable by another user
- [ ] `bd close <task-id> "STORY-014 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
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

- **STORY-014a:** Settrade equity branch — credential storage, OAuth, `get_portfolio()`, holdings upsert
- **STORY-014b:** InnovestX digital asset branch — HMAC-SHA256 auth, balance endpoint, holdings upsert, Settings UI for both sections

Create `STORY-014b.md` as a sibling file in `EPIC-04-broker-fetch/` before starting STORY-014a. Add both to `stories/epics.md` and `PROGRESS.md`.
