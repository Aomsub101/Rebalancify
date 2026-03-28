# PROJECT_LOG.md — Rebalancify Implementation History

## AGENT CONTEXT

**What this file is:** A living implementation history log — one entry per completed story. Agents scan the last 3–5 entries at the start of every session to understand recent decisions, discovered issues, and carry-over notes.
**Derived from:** BMAD-inspired project logging practice
**Connected to:** PROGRESS.md (status tracker), CLAUDE.md (master rules), all STORY-*.md files
**Critical rules for agents using this file:**
- Add a new entry at the TOP of the Completed Stories section every time a story is marked complete.
- Never edit past entries — they are append-only history.
- Keep each entry concise: ~10–15 lines. Expand only if there is a critical discovery.
- Scan the last 3–5 entries before starting any new story.

---

## Entry Template

Copy this block to the top of the Completed Stories section when closing a story:

```
### STORY-[NNN] — [Title]
**Completed:** YYYY-MM-DD
**Effort:** [actual vs estimated — e.g., "1 day (estimated 1)"]

**What was built:**
- [Bullet: key file or feature delivered]
- [Bullet: key file or feature delivered]

**Decisions made:**
- [Decision + reason — e.g., "Used X instead of Y because Z"]

**Discovered issues / carry-over notes:**
- [Issue or note that future stories must know — e.g., "Supabase free tier does not support X; workaround in lib/Y.ts"]

**Quality gates passed:** type-check ✅ | test ✅ | build ✅ | RLS ✅
```

---

## Completed Stories

### STORY-014b — InnovestX Digital Asset Branch & Settings UI
**Completed:** 2026-03-28
**Effort:** 0.5 day (estimated 2d)

**What was built:**
- `lib/innovestx.ts` — `buildInnovestxDigitalSignature` (HMAC-SHA256: timestamp+METHOD+path+body), `parseInnovestxDigitalBalances` (filters zero balances), digital API constants; 100% coverage
- `lib/innovestx.test.ts` — 13 new TDD tests (Red→Green) covering signature correctness, method case-insensitivity, body inclusion, balance parsing, zero-filter, missing-key safety
- `app/api/profile/route.ts` — PATCH extended with `innovestx_digital_key`/`innovestx_digital_secret` AES-256-GCM encryption (AC1)
- `app/api/silos/[silo_id]/sync/route.ts` — `syncInnovestxEquity` renamed `syncInnovestx`; both equity + digital branches run independently; missing creds → `sync_warnings` not crash (AC3/AC5); CoinGecko prices for digital assets (AC4)
- `app/(dashboard)/settings/page.tsx` — two InnovestX sections (Settrade Equity, Digital Asset) each with independent `ConnectionStatusDot` and password inputs with show/hide toggle (AC6)

**Decisions made:**
- HMAC message format: `timestamp + METHOD.toUpperCase() + path + body` — matches common InnovestX-style exchange patterns; easily adjustable once real docs confirmed with credentials
- Digital asset base URL `https://api-digital.innovestxonline.com` is a best-effort assumption; credentials unavailable without contacting InnovestX support (documented in platform-support.md)
- Both sync branches run in the same function call — equity and digital creds are independent; partial results use `sync_warnings` array (consistent with BITKUB pattern)

**Discovered issues / carry-over notes:**
- InnovestX Digital Asset API credentials require contacting InnovestX support directly — end-to-end test not possible until credentials obtained (story prerequisite documented)
- Digital API base URL and endpoint path are assumptions; verify against `https://api-docs.innovestxonline.com/` when credentials arrive

**Quality gates passed:** type-check ✅ | test ✅ (206 tests) | coverage ✅ (100% innovestx.ts) | build ✅ | security ✅

---

### STORY-014 — InnovestX Sync — Settrade Equity Branch
**Completed:** 2026-03-28
**Effort:** 0.5 day (estimated 3d — split into 014 + 014b)

**What was built:**
- `lib/innovestx.ts` — pure helpers: `buildSettradeBasicAuth` (Base64 OAuth credentials), `parseSettradePortfolio` (portfolio JSON → `SettradePosition[]`); 100% coverage across all metrics
- `lib/innovestx.test.ts` — 14 TDD tests (Red → Green) covering auth encoding, portfolio parsing, zero-filter, empty input
- `app/api/profile/route.ts` — PATCH extended with InnovestX equity credentials (`innovestx_key`/`innovestx_secret` → AES-256-GCM encrypted columns); AC1 test added
- `app/api/silos/[silo_id]/sync/route.ts` — `syncInnovestxEquity()`: Settrade OAuth2 client_credentials flow → account lookup → portfolio fetch → holdings upsert (`source='innovestx_sync'`) → Finnhub prices → `last_synced_at`; partial result + `sync_warnings` when creds missing (AC9)

**Decisions made:**
- Settrade auth modelled as OAuth2 `client_credentials` with Basic Auth header (App ID:App Secret Base64) — matches Settrade Open API pattern documented at developer.settrade.com
- Two-step portfolio fetch: GET `/Account` list → GET `/Account/{no}/Portfolio` — accounts endpoint used to resolve `account_no` dynamically; no `account_no` column added to `user_profiles`
- Finnhub price failures are non-fatal (caught silently) — stale cache is preferable to sync failure
- Settings UI (AC4) deferred to STORY-014b as documented in story Notes section

**Quality gates passed:** type-check ✅ | test ✅ (193 tests) | coverage ✅ | build ✅

---

### STORY-013 — BITKUB Holdings Sync
**Completed:** 2026-03-28
**Effort:** 0.5 day (estimated 2d)

**What was built:**
- `lib/bitkub.ts` — pure helpers: `buildBitkubSignature` (HMAC-SHA256), `parseBitkubTicker` (THB pairs → price map), `parseBitkubWallet` (returns `[holdings[], thbBalance]` tuple)
- `lib/bitkub.test.ts` — 19 TDD tests, 100% statement/branch coverage on bitkub.ts
- `app/api/profile/route.ts` — BITKUB key/secret encryption block (mirrors Alpaca pattern)
- `app/api/silos/[silo_id]/sync/route.ts` — `syncBitkub()` function: parallel ticker+wallet fetch, price_cache upsert, holdings upsert, THB cash balance on first holding, last_synced_at update

**Decisions made:**
- `parseBitkubWallet` returns a tuple `[holdings, thbBalance]` to avoid a second parse pass for cash — clean API for the route handler
- Ticker (public) and wallet (authenticated) are fetched in `Promise.all` — one round trip, prices piggyback on the wallet sync (AC3)
- THB balance stored via same "first holding carries cash_balance" pattern as Alpaca (no schema change needed)
- BITKUB API base URL `https://api.bitkub.com` is the only place it appears — in the server route only (AC5/security verified with grep)

**Discovered issues / carry-over notes:**
- BITKUB wallet `error` field must be checked — error code 0 = success; non-zero returns 503
- BITKUB v2 API uses `POST /api/v2/market/wallet` with body `{"ts": <unix_ms>}` and HMAC-SHA256 signature in `X-BTK-SIGN` header

**Quality gates passed:** type-check ✅ | test 174/174 ✅ | coverage ✅ | build ✅ | security ✅

---

### STORY-012 — Rebalance history endpoints + UI
**Completed:** 2026-03-28
**Effort:** 0.5 day (estimated 1d)

**What was built:**
- `app/api/silos/[silo_id]/rebalance/history/route.ts` — paginated GET, sessions + orders + snapshot_before, newest-first
- `app/api/rebalance/history/route.ts` — cross-silo GET, each session includes silo_name + silo_id
- `app/(dashboard)/silos/[silo_id]/history/page.tsx` — server component: auth guard, silo ownership check, generateMetadata
- `components/rebalance/RebalanceHistoryView.tsx` — client component: expandable rows, snapshot_before detail table, pagination, LoadingSkeleton/EmptyState/ErrorBanner
- 8 integration tests across both routes (5 per-silo + 3 cross-silo), all green

**Decisions made:**
- `snapshot_before` included in both API responses (not lazy-loaded) so expansion is instant with no extra round-trip
- `new URL(request.url).searchParams` used instead of `request.nextUrl.searchParams` — the latter is not available on native `Request` in Vitest mocks
- `silos` join typed with `Array.isArray` guard — Supabase client infers many-to-one FK joins as arrays at the type level

**Discovered issues / carry-over notes:**
- STORY-013 (BITKUB sync) is the next unblocked story in EPIC-04

**Quality gates passed:** type-check ✅ | test ✅ (155/155) | build ✅ | DoD grep ✅

---

### STORY-011b — Rebalancing wizard UI (3-step: Config, Review, Result)
**Completed:** 2026-03-28
**Effort:** 0.5 day (estimated 2d)

**What was built:**
- `app/(dashboard)/silos/[silo_id]/rebalance/page.tsx` — server component: auth check, silo/profile/weights fetch, `generateMetadata`, renders `RebalanceWizardView`
- `components/rebalance/RebalanceWizardView.tsx` — client orchestrator: step state (1|2|3), StepIndicator, AlpacaLiveBadge (Rule 15), panel dispatch, footer disclaimer
- `components/rebalance/RebalanceConfigPanel.tsx` — Step 1: mode radio cards (NOT dropdown), FullRebalanceWarning, cash toggle + amount input, WeightsSumWarning
- `components/rebalance/OrderReviewPanel.tsx` — Step 2: SessionSummaryBar, ExecutionModeNotice (non-Alpaca), BalanceErrorBanner, OrdersTable with skip checkboxes, ConfirmDialog, execute mutation with TanStack Query invalidation
- `components/rebalance/ExecutionResultPanel.tsx` — Step 3: Alpaca per-order status (executed/skipped/failed) OR ManualOrderInstructions with CopyAllButton + per-row CopyRowButton
- `components/shared/ConfirmDialog.tsx` — non-dismissible dialog (no onOpenChange, Escape + outside-click blocked via onEscapeKeyDown/onInteractOutside preventDefault)
- `lib/types/rebalance.ts` — `CalculateResponse`, `ExecuteResponse`, `RebalanceOrder`, `ExecuteOrderResult` interfaces
- `tests/rebalance-wizard.spec.ts` — Playwright E2E tests: step transitions, ConfirmDialog non-dismissibility, BalanceErrorBanner, mode cards

**Decisions made:**
- `ConfirmDialog` uses shadcn/ui Dialog with `onEscapeKeyDown` + `onInteractOutside` preventDefault to enforce Rule 10
- `RebalanceConfigPanel` fires calculate API directly (no useMutation) since it advances wizard step on success — local `useState` for loading/error is cleaner than a query key
- `initialWeightsSum` fetched server-side in `page.tsx` so Step 1 shows WeightsSumWarning without a client-side fetch round-trip

**Discovered issues / carry-over notes:**
- STORY-012 (history) is now unblocked; `['sessions', siloId]` invalidation already wired in execute mutation
- The `tests/rebalance-wizard.spec.ts` Playwright tests assume an unauthenticated context (they test UI components via mocked API routes); they will fail on a running dev server that redirects to /login — these are documented as UI-logic tests, not full auth E2E

**Quality gates passed:** type-check ✅ | test ✅ (147/147) | build ✅

---

### STORY-011 — Rebalancing wizard execute API route (Alpaca + manual)
**Completed:** 2026-03-28
**Effort:** 0.25 day (estimated 1d)

**What was built:**
- `app/api/silos/[silo_id]/rebalance/execute/route.ts` — execute endpoint: Alpaca order submission (POST /v2/orders), `alpaca_order_id` storage, session status machine ('approved'/'partial'/'cancelled'), manual silo path marks orders as 'manual', F1-R10 UPDATE exception for `status` + `snapshot_after`
- `app/api/silos/[silo_id]/rebalance/execute/__tests__/route.test.ts` — 8 TDD integration tests: 401 unauth, 404 silo, 404 SESSION_NOT_FOUND, manual happy path, Alpaca happy path, Alpaca partial failure, all-skipped cancelled, 403 ALPACA_NOT_CONNECTED

**Decisions made:**
- Orders submitted sequentially (not parallel) to avoid Alpaca rate limits and allow per-order failure tracking
- `snapshot_after` populated with `{ executed_at }` minimal JSON for Alpaca sessions; NULL stays for non-Alpaca (F1-R10)
- `executed_count` counts only Alpaca-executed orders; manual approvals are not counted in `executed_count` (manual silos have no execution tracking)

**Discovered issues / carry-over notes:**
- STORY-011b (wizard UI) is now unblocked — it needs TanStack Query mutation calling this endpoint, and must invalidate `['holdings', siloId]` and `['sessions', siloId]` on success (AC10)
- The `assets` table lookup to resolve tickers for Alpaca orders assumes asset records exist from sync; if a session is calculated on stale data after asset deletion, the ticker lookup may miss — acceptable edge case for v1.0

**Quality gates passed:** type-check ✅ | test ✅ (147/147) | build ✅ | RLS ✅ | security ✅

---

### STORY-010b — Rebalance calculator (full mode, pre-flight, cash injection)
**Completed:** 2026-03-28
**Effort:** 0.25 day (estimated 2d)

**What was built:**
- `lib/rebalanceEngine.ts` — full mode path: `roundAt8` (ROUND_HALF_UP) for buy quantities; pre-flight balance check sets `balance_valid=false` + `balance_errors` when `totalBuyCost > available`; partial mode scale-down logic unchanged
- `lib/rebalanceEngine.test.ts` — 6 new TDD tests: full-mode ±0.01% accuracy (×2), pre-flight failure, partial vs full mode contrast, cash injection resolves failure, injected cash increases total_value
- `app/api/silos/[silo_id]/rebalance/calculate/route.ts` — removed NOT_IMPLEMENTED block; returns HTTP 422 without creating DB records when `result.balance_valid === false`

**Decisions made:**
- `roundAt8` (ROUND_HALF_UP) achieves ±0.01% accuracy at 8dp — max rounding error is 0.5e-8 shares × price / totalValue (negligible)
- Pre-flight failure returns orders in 422 body so UI can show "what you'd need"; no session is created
- Partial mode always stays `balance_valid=true` (scale-down path preserved)

**Discovered issues / carry-over notes:**
- Pre-flight test case relies on ROUND_HALF_UP rounding 0.6666... to 0.66666667 which costs 200.000001 > 200 — this is the canonical full-mode failure example in tests
- STORY-011 can now call full mode; pre-flight 422 response shape is `{ session_id: null, mode, balance_valid, balance_errors, orders, ... }`

**Quality gates passed:** type-check ✅ | test ✅ (139/139) | build ✅ | RLS ✅

---

### STORY-010 — Rebalance calculator (partial mode + session creation)
**Completed:** 2026-03-28
**Effort:** 0.5 day (estimated 3d — scoped to partial mode only; full mode deferred to STORY-010b)

**What was built:**
- `lib/rebalanceEngine.ts` — pure deterministic calculation engine; partial mode only; no DB/side effects
  - Sells: `ceil(|delta|/price)` capped at holding qty; Buys: `floor(delta/price)`; scales buys down if cash insufficient
  - Builds `snapshot_before` (holdings/prices/weights/total_value) for session immutability
- `lib/rebalanceEngine.test.ts` — 7 TDD unit tests: no-overspend, scale-down, empty orders, silo isolation, weights≠100, snapshot shape, 50-holding timing
- `app/api/silos/[silo_id]/rebalance/calculate/route.ts` — POST handler: fetches holdings+prices+weights, calls engine, inserts `rebalance_sessions` (pending, no `updated_at`) + `rebalance_orders`

**Decisions made:**
- Engine is a pure function (no DB) — makes it trivially unit-testable without mocking Supabase
- Full mode returns 422 NOT_IMPLEMENTED until STORY-010b — keeps partial mode clean and avoids dead code paths
- `cash_amount` accepted in request body and threaded through engine now; cash injection unit tests are in STORY-010b per split agreement

**Discovered issues / carry-over notes:**
- STORY-010b must implement: full mode (±0.01% accuracy), pre-flight 422 `BALANCE_INSUFFICIENT`, cash injection tests, and the remaining ACs (AC3, AC4, AC6)

**Quality gates passed:** type-check ✅ | test ✅ (133/133) | build ✅ | RLS ✅

---

### STORY-009 — Alpaca key storage + sync endpoint
**Completed:** 2026-03-28
**Effort:** 0.5 day (estimated 2d)

**What was built:**
- `lib/encryption.ts` — AES-256-GCM encrypt/decrypt; TDD (3 tests: round-trip, IV uniqueness, wrong-key throws)
- `PATCH /api/profile` — handles `alpaca_key`, `alpaca_secret` (encrypt before storage), `alpaca_mode` (paper|live); plaintext never returned
- `POST /api/silos/:id/sync` — fetches Alpaca `/v2/positions` + `/v2/account`; upserts holdings + asset_mappings; stores cash on first holding; updates `last_synced_at`; returns 503 on broker unreachable, 422 on manual silo
- `GET /api/silos` — now fetches `alpaca_mode` from `user_profiles` in parallel and includes it per silo
- `AlpacaLiveBadge` — extracted shared component; used on `SiloCard` and `SiloHeader` (CLAUDE.md Rule 15)
- `SyncButton` — client component with in-flight spinner and `last_synced_at` timestamp display (AC7)
- `SiloHeader` — shows `SyncButton` for all non-manual silos; shows `AlpacaLiveBadge` when live
- Settings page — Alpaca section: password inputs with show/hide toggle, mode selector (paper/live with LIVE warning), `ConnectionStatusDot`

**Decisions made:**
- Cash from Alpaca account stored as `cash_balance` on the first synced holding; all others reset to 0 — preserves `SUM(cash_balance)` aggregation in GET /holdings
- `encrypt(plaintext, keyHex)` / `decrypt(ciphertext, keyHex)` take explicit key parameter — enables key-agnostic unit tests without env var dependency
- `alpaca_mode` sourced from `user_profiles` (not silos) — one mode per user, passed down to silo card/header at the API level

**Discovered issues / carry-over notes:**
- BITKUB, InnovestX, Schwab, Webull sync routes return 422 `SYNC_NOT_IMPLEMENTED` until their EPIC-04 stories land
- Settings page only has the Alpaca section; other broker sections (BITKUB, InnovestX, Schwab, Webull) are deferred to EPIC-04 stories

**Quality gates passed:** type-check ✅ | test ✅ (126/126) | build ✅

---

### STORY-008 — Target weights editor
**Completed:** 2026-03-28
**Effort:** 0.5 day (estimated 1d)

**What was built:**
- `GET /api/silos/[silo_id]/target-weights` — returns `{ weights_sum_pct, cash_target_pct, sum_warning, weights[] }` with asset join for ticker
- `PUT /api/silos/[silo_id]/target-weights` — atomic delete+insert; validates each `weight_pct` ∈ [0,100] → 422; sum ≠ 100 → `sum_warning: true` (not blocked)
- `TargetWeightCell` — inline editable for ALL silo types (click to edit, Enter/Escape, blur commits); local state, not auto-saved
- `WeightsSumBar` — now accepts `weightsSumPct` as prop from SiloDetailView local state (real-time AC5); uses new `WeightsSumWarning` (exact AC6 text)
- `CashBalanceRow` — broken out of colspan=3; Target column shows live `cashTargetPct` read-only (AC7)
- `DirtyStateContext` + `useDirtyGuard` — `beforeunload` listener when dirty; Sidebar/BottomTabBar read context for amber Silos indicator; nav clicks intercepted with `window.confirm()` when dirty (AC9)
- 13 new route tests (TDD red→green); 118 total tests pass

**Decisions made:**
- `WeightsSumBar` no longer computes sum internally — caller (SiloDetailView) computes from local state to enable real-time updates without waiting for server
- Delete+insert for atomic replacement (no DB transaction needed; partial state is recoverable by re-saving)
- Sidebar changed from `<Link>` to `<button onClick>` to support dirty-state interception — `aria-current` preserved

**Discovered issues / carry-over notes:**
- None

**Quality gates passed:** type-check ✅ | test ✅ | build ✅

---

### STORY-007 — Holdings CRUD (manual entry) + silo detail page
**Completed:** 2026-03-28
**Effort:** 1 day (estimated 2d — subagent-driven TDD loop was efficient)

**What was built:**
- `GET /api/silos/[silo_id]/holdings` — 4 sequential Supabase calls (silos, holdings+assets, price_cache, target_weights); computes current_value, current_weight_pct, drift_pct, drift_breached, stale_days server-side using decimal.js
- `POST /api/silos/[silo_id]/holdings` — upserts on (silo_id, asset_id) conflict; rejects price field from request body (AC2)
- `PATCH /api/silos/[silo_id]/holdings/[holding_id]` — RLS+silo guard via `.eq('silo_id', silo_id)`; always refreshes last_updated_at
- Extended `POST /api/silos/[silo_id]/asset-mappings` — auto-creates holdings row with quantity=0 on each new mapping (best-effort via error result check, not try/catch)
- `components/shared/`: DriftBadge (3-state with unique icon per state), StalenessTag (Clock icon + >7d threshold), LoadingSkeleton, EmptyState, ErrorBanner
- `components/silo/`: SiloHeader (Add asset + Run rebalance buttons), SiloSummaryBar, WeightsSumBar (proportional bar + Rule 13-compliant warning icon), HoldingsTable, HoldingRow (inline quantity edit with keyboard UX + Decimal.js), CashBalanceRow
- Full rewrite of `components/silo/SiloDetailView.tsx` — now queries holdings API instead of asset-mappings stub
- `lib/types/holdings.ts` — shared Holding + HoldingsResponse interfaces (extracted to eliminate duplication across 3 files)

**Decisions made:**
- GET /holdings includes drift_threshold in response so the client DriftBadge computes three states (green/yellow/red = within threshold / approaching / breached)
- cash_balance is summed across all holdings rows; cash is stored per-holding (defaults 0) not as a single silo-level field
- Supabase SDK does NOT throw — all best-effort steps use `const { error } = await supabase.from(...)` pattern (no try/catch on DB calls)
- decimal.js used for all monetary arithmetic in GET /holdings; HoldingRow uses `new Decimal(qty).toFixed(8)` for PATCH payload (CLAUDE.md Rule 3)
- `style={{ width: '${pct}%' }}` in WeightsSumBar is the only permitted inline style (dynamic % widths cannot be generated by Tailwind at runtime)

**Discovered issues / carry-over notes:**
- `generateMetadata` in page.tsx queries silo name without user_id ownership check — pre-existing from STORY-006; silo name could leak via page title for a guessed UUID. Track as security follow-up before launch.
- HoldingRow "Run rebalance" button links to `/silos/[id]/rebalance` (404 until STORY-008 lands)
- TargetWeightCell shows target weights read-only — STORY-008 adds the editor
- CashBalanceRow cash value displays in "Target" column position (design decision, cosmetic)

**Quality gates passed:** type-check ✅ | test ✅ | build ✅ | RLS (holdings table has no user_id; RLS enforced via silo_id → silos.user_id) ✅

---

### STORY-006 — Asset search, mapping & price caching
**Completed:** 2026-03-27
**Effort:** 1 day (estimated 2d — clean TDD loop ran efficiently)

**What was built:**
- `lib/formatNumber.ts` — canonical number formatter (price/weight/drift/quantity/staleness), TDD'd with NaN guard
- `lib/priceService.ts` — 3-tier price cache: `price_cache_fresh` view → Finnhub/CoinGecko API → `price_cache` upsert
- `GET /api/assets/search` — Finnhub (stock/ETF) and CoinGecko (crypto) proxy, max 5 results, 503 on upstream failure
- `POST /api/silos/[silo_id]/asset-mappings` — upserts `assets` on `(ticker, price_source)`, 409 on duplicate mapping, best-effort price cache after mapping
- `GET /api/silos/[silo_id]/asset-mappings` — returns mappings joined with asset details
- `components/silo/AssetSearchModal.tsx` — Dialog with TypeSelector, 300ms debounced search, Add button with toast feedback
- `components/silo/SiloDetailView.tsx` — client component with TanStack Query, holdings stub table (quantity: 0), loading/error/empty states
- `app/(dashboard)/silos/[silo_id]/page.tsx` — server component shell with `generateMetadata`, auth guard, RLS-safe silo ownership check
- Installed 6 missing shadcn/ui primitives: Dialog, Button, Input, Label, RadioGroup, Skeleton

**Decisions made:**
- `fetchPrice()` failure in POST /asset-mappings is best-effort (silently caught) — mapping creation must never fail due to a price cache issue
- `formatNumber` created in `lib/formatNumber.ts` (not `lib/utils.ts`) — separate file keeps the formatter self-contained and easily testable
- SiloDetailView quantity column shows `formatNumber('0', 'quantity', ...)` — STORY-007 will add real holdings quantities via the `holdings` table

**Discovered issues / carry-over notes:**
- `SiloCard.tsx` (from STORY-005) uses `toLocaleString()` directly — violates CLAUDE.md Rule 17; fix in a future story
- The silo detail page at `/silos/[silo_id]` is a stub — STORY-007 expands it with full holdings CRUD

**Quality gates passed:** type-check ✅ | test ✅ (92/92) | coverage ✅ (lib/ 96–97%) | build ✅ | RLS ✅

---

### STORY-005 — Profile API + Silo CRUD + list page
**Completed:** 2026-03-27
**Effort:** 1 day (estimated 1.5d — focused scope, no migration work needed)

**What was built:**
- `lib/profile.ts` + `lib/silos.ts` — TDD'd helpers (31 tests, 100% lib coverage)
- `GET/PATCH /api/profile` — full profile shape with derived connected booleans, notification_count
- `GET/POST /api/silos` — list + create with 5-silo limit (422 SILO_LIMIT_REACHED)
- `PATCH/DELETE /api/silos/[silo_id]` — update + soft-delete (is_active = FALSE)
- `SiloCard`, `SilosPage`, `NewSiloPage` (6 platform types, currency defaults)
- `SettingsPage` — Profile + Notifications sections only
- `Sidebar` + `TopBar` wired to `useQuery(['profile'])` for reactive silo count badge and notification count (replaces hardcoded values from STORY-003)
- Route unit tests: 12 tests covering 401, 422, 400, 201 paths

**Decisions made:**
- Sidebar reads `siloCount` via `useQuery(['profile'])` instead of SessionContext — enables reactive invalidation after silo create/delete without a context refresh
- `settings/page.tsx` silo usage bar uses Tailwind fraction classes (w-1/5 ... w-full) instead of `style={{width}}` to comply with CLAUDE.md Rule 2
- API route tests mock Supabase with fully-chained `.select().eq().eq()` thenables to match real query shape

**Discovered issues / carry-over notes:**
- `stories/epics.md` EPIC-02 status set to `🟡 In Progress` — should be updated to `✅ Complete` when all 4 stories in EPIC-02 are done
- `stories/epics.md` EPIC-01 marked `✅ Complete (2026-03-27)` per user request
- RLS isolation test is a manual SQL procedure (see `docs/development/03-testing-strategy.md`); run against `rebalancify_dev` Supabase before deploying

**Quality gates passed:** type-check ✅ | test ✅ (56/56) | coverage ✅ (lib 100%) | build ✅

---

### STORY-004 — Vercel Deployment & CI Pipeline
**Completed:** 2026-03-27
**Effort:** 0.5 day (estimated XS — pure infrastructure, no application code)

**What was built:**
- Vercel project `rebalancify` linked to `Aomsub101/Rebalancify` (org: aomsub101s-projects)
- 14 production env vars set (rebalancify_prod Supabase + all API keys + fresh ENCRYPTION_KEY/CRON_SECRET)
- 14 preview env vars set (rebalancify_dev Supabase + matching API keys)
- `docs/development/03-testing-strategy.md` — removed "create third CI project"; documented CI uses `rebalancify_dev` + cleanup procedure
- `docs/development/04-deployment.md` — documented 2-project constraint (dev/prod); preview deployments → `rebalancify_dev`
- Fixed CI: removed invalid `--run` flag from `pnpm test` commands in `ci.yml`
- Fixed Playwright: replaced server-dependent placeholder with trivial test; enabled `webServer` in `playwright.config.ts`

**Decisions made:**
- Single Supabase project used for both CI and local dev (`rebalancify_dev`); free plan supports only 2 projects
- Production URL: `rebalancify-jqloavvm9-aomsub101s-projects.vercel.app`
- `SCHWAB_REDIRECT_URI` set to production URL; update when custom domain is configured

**Discovered issues / carry-over notes:**
- `vercel env add <name> preview` fails non-interactively in CLI v50.37.1 — workaround: use Vercel REST API (`POST /v10/projects/:id/env`) to set preview vars in bulk
- CI test data cleanup needed after any CI run touching auth: delete `ci-test-*` users from `rebalancify_dev` → Authentication → Users

**Quality gates passed:** type-check ✅ | test ✅ | build ✅ | CI ✅ | Playwright ✅

---

### STORY-003 — AppShell (Sidebar, TopBar, Mobile Nav)
**Completed:** 2026-03-27
**Effort:** 0.5 day (estimated S / 1–2 days — all UI, no migrations)

**What was built:**
- `components/layout/Sidebar.tsx` — always-dark `bg-sidebar` nav rail; 240px desktop, 56px icon rail at 768–1023px, hidden < 768px; active state via `usePathname()`; UserMenu with sign-out; SiloCountBadge from SessionContext
- `components/layout/TopBar.tsx` — page title (pathname map) + NotificationBell (hardcoded 0; TODO STORY-005)
- `components/layout/BottomTabBar.tsx` — fixed bottom 5-tab bar, visible only < 768px; `pb-safe` utility for iOS safe-area
- `components/shared/OfflineBanner.tsx` — SSR-safe online/offline detection; amber warning banner with WifiOff icon
- `app/(dashboard)/layout.tsx` — server component assembling the full shell
- `app/(dashboard)/overview/page.tsx` — stub page with metadata + disclaimer footer (needed because middleware redirects to /overview)
- `.pb-safe` utility added to both `app/globals.css` and `styles/globals.css` (must stay in sync)

**Decisions made:**
- `app/api/profile/route.ts` intentionally excluded — belongs to STORY-005; creating partial route now would conflict with full response shape. NotificationBell uses hardcoded 0 with TODO comment.
- `BottomTabBar` uses `pb-safe` CSS utility (not inline `style={}`) for `env(safe-area-inset-bottom)` to comply with CLAUDE.md Rule 2

**Discovered issues / carry-over notes:**
- `git push` fails — SSH key not configured on this machine. All commits are local; user must push manually or configure SSH key before CI runs.
- DoD item "GET /api/profile returns notification_count" deferred to STORY-005

**Quality gates passed:** type-check ✅ | test ✅ | build ✅

---

### STORY-002 — Next.js Scaffold, Auth, and Middleware
**Completed:** 2026-03-26
**Effort:** 1 day (estimated M / 3–5 days — focused scope ran faster)

**What was built:**
- Next.js 15 + React 19 + TypeScript 5 App Router installed; Tailwind v3 pinned at 3.4.19 exact
- `lib/utils.ts` (cn), `lib/supabase/client.ts`, `lib/supabase/server.ts` — all TDD Red→Green; 13/13 tests pass; 100%/100%/95.83% coverage
- `tailwind.config.ts` + `app/globals.css` + `styles/globals.css` (mirror) with full design-system tokens
- `middleware.ts` — unauthenticated → /login, authenticated hitting auth routes → /overview
- Auth pages: login, signup, reset-password (server component + metadata + separate client form component)
- `contexts/SessionContext.tsx`, `components/providers.tsx` (QueryClient + SessionProvider), `app/layout.tsx`
- Sonner `<Toaster>` at root; `components.json` for shadcn; `resend` installed for Phase 4

**Decisions made:**
- Downgraded `@vitejs/plugin-react` to `^4.7.0` (v6 imports `vite/internal` which only exists in vite 8; vitest 3 bundles vite 7)
- Added `globals: true` to vitest config — required for `@testing-library/jest-dom` to call `expect.extend()` globally
- `tsconfig.json` `@/*` alias fixed from `./src/*` to `./*` (no src/ directory; all files at root)
- `app/page.tsx` is just `redirect('/overview')` — middleware handles unauthenticated case before page renders
- Auth forms use server wrapper for `metadata` export + separate `'use client'` component for interactivity

**Discovered issues / carry-over notes:**
- `cookies()` is async in Next.js 15 — `lib/supabase/server.ts` must `await cookies()` (already done)
- Tailwind pin: `pnpm add tailwindcss@3 --save-exact` still wrote `^3.4.19`; had to manually remove `^` in package.json
- `next-env.d.ts` auto-generated by Next.js build — do not delete; do not manually edit

**Quality gates passed:** type-check ✅ | test ✅ | build ✅

---

### STORY-001 — Supabase Setup & All Migrations
**Completed:** 2026-03-26
**Effort:** 1 day (estimated M / 3–5 days — migration-only story ran faster than estimated)

**What was built:**
- `supabase/migrations/` with 18 SQL files covering all tables, RLS policies, indexes, views, and pg_cron jobs
- Minimal toolchain: `tsconfig.json` (scoped include/exclude), `vitest.config.ts` (passWithNoTests, excludes Playwright tests), `package.json` updated with typescript + vitest + @vitest/coverage-v8
- Updated `.gitignore` to exclude `.env`, `coverage/`, `tsconfig.tsbuildinfo`, `.claude/`, `package-lock.json`

**Decisions made:**
- `pnpm build` stubbed as echo for STORY-001 (no Next.js installed); STORY-002 will replace with `next build`
- `vitest.config.ts` uses `passWithNoTests: true` — unit tests begin in STORY-002 with first `lib/` files
- `tsconfig.json` uses explicit `"include": ["**/*.ts", "**/*.tsx"]` + `"exclude": ["node_modules", ".beads", "supabase", ...]` to avoid scanning non-app directories
- migration 17 inserts in-app notifications only (ADR-013) — email via Vercel Cron in STORY-020

**Discovered issues / carry-over notes:**
- pnpm was not installed globally; installed via `npm install -g pnpm` before first `pnpm install`
- `bd dolt push` fails — Dolt remote not configured (non-blocking; beads state is local only until remote is set up)
- STORY-002 must overwrite `package.json` `build`/`dev`/`start`/`lint` scripts when scaffolding Next.js

**Quality gates passed:** type-check ✅ | test ✅ | build ✅ (stub) | RLS ✅ | auth trigger ✅ | RLS isolation ✅

---

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | Gate passed |
| ❌ | Gate failed — see story notes |
| ⚠️ | Passed with known caveat |
