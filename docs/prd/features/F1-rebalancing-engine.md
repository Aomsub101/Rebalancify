# docs/prd/features/F1-rebalancing-engine.md — Feature 1: Portfolio Tracking & Rebalancing Engine

## AGENT CONTEXT

**What this file is:** The complete requirement specification for the rebalancing engine — the core calculation and execution feature of Rebalancify.
**Derived from:** PRD_v1.3.md Section 6 Feature 1, FEATURES_v1.3.txt Feature 1
**Connected to:** docs/architecture/02-database-schema.md (holdings, target_weights, rebalance_sessions, rebalance_orders), docs/architecture/03-api-contract.md (Section 9 Rebalancing Endpoints), docs/architecture/04-component-tree.md (Section 2.5 Rebalance Page), stories/EPIC-03-alpaca-integration/
**Critical rules for agents using this file:**
- F1-R9 is absolute: calculations must never cross silo boundaries. Assert this in every test.
- F1-R10 defines the single permitted exception to session immutability: `snapshot_after` may be set by the execute endpoint after Alpaca confirms order results. All other columns on `rebalance_sessions` are never updated after creation.
- The ConfirmDialog for order execution must not be dismissible by clicking outside or pressing Escape (CLAUDE.md Rule 10).

---

## Feature Purpose

The core calculation engine. Accepts manually entered quantities or API-fetched holdings and computes deterministic buy/sell orders to bring each platform silo to user-defined target weights. All execution requires explicit user approval before any order is placed. Calculation is always silo-scoped.

---

## Requirements

### F1-R1 — Manual Holdings Input

Support manual input of holdings quantities and cash balances for non-API platforms (e.g., DIME, any custom manual silo). The user enters quantities only — current prices are fetched automatically and never entered manually by the user.

**Implementation constraint:** The `POST /silos/:silo_id/holdings` endpoint accepts `quantity` and `cost_basis` but never a `price` field. Prices come from `price_cache` only.

**Acceptance test:** A POST to `/silos/:id/holdings` with a `price` field must ignore that field (or reject it) and use `price_cache` for all display and calculation.

---

### F1-R2 — Alpaca Integration (v1.0)

API integration with Alpaca for both paper trading and live trading accounts. Supports automated fetching of current holdings and cash balances, and submission of buy/sell orders strictly upon explicit user approval via a non-dismissible confirmation dialog. **This is the only platform that supports automated order execution in v1.0.**

**Implementation constraint:** All Alpaca API calls (positions fetch, order submission) must be proxied through `app/api/silos/[silo_id]/sync/route.ts` and `app/api/silos/[silo_id]/rebalance/execute/route.ts` respectively. The Alpaca API key must never appear in client-side code.

**Acceptance test:** A network inspection of the browser during Alpaca sync must show zero requests to `api.alpaca.markets` or `paper-api.alpaca.markets` — only requests to `/api/...`.

---

### F1-R3 — Automatic Price Fetching (Three-Tier)

Price fetching is automatic for all asset types. The correct source is determined by the silo type and asset type:

| Tier | Applies To | Source | Cache TTL |
|---|---|---|---|
| Tier 1a | Alpaca silos | Alpaca API at sync time | Updated on each manual sync |
| Tier 1b | BITKUB silos | BITKUB `/api/market/ticker` | 15 minutes (shared global cache) |
| Tier 2 | Manual silos — stocks/ETFs | Finnhub `/quote` | 15 minutes (shared global cache) |
| Tier 3 | Manual silos — crypto | CoinGecko `/simple/price` | 15 minutes (shared global cache) |

**Implementation constraint:** The price fetch service must check `price_cache_fresh` view before calling any external API. If `is_fresh = TRUE`, use cached price. Manual refresh bypasses TTL always.

**Acceptance test:** Two consecutive price fetch calls within 15 minutes to the same asset must result in exactly one external API call (the second must use cache).

---

### F1-R4 — Asset Search and Ticker Confirmation

When a user adds an asset to a manual silo: the app queries Finnhub (stocks/ETFs) or CoinGecko (crypto) and presents a ranked list of matching results. The user selects and confirms the correct match. This confirmed mapping is stored permanently — the user never repeats this confirmation for the same asset in the same silo.

**Implementation constraint:** After `POST /silos/:id/asset-mappings` creates the record, subsequent additions of the same asset to the same silo must detect the existing mapping via `UNIQUE(silo_id, asset_id)` constraint and skip the confirmation step.

**Acceptance test:** After confirming AAPL in silo A, adding AAPL again to silo A must skip the search modal and proceed directly to quantity entry. Adding AAPL to silo B must still show the search modal (different silo).

---

### F1-R5 — Sell-to-Buy Mode with Cash Injection

The rebalancing calculator operates in sell-to-buy mode. The user may optionally inject cash by entering a cash amount and toggling "Include cash in rebalancing" per session.

**Cash remainder rule:** When target weights sum to less than 100%, the system displays a persistent warning: `"Your targets sum to X%. The remaining Y% will be held as cash after rebalancing."` This warning is informational — it does not block saving or calculating.

**Implementation constraint:** The warning must appear in two places: (1) the WeightsSumBar in the silo detail page, (2) Step 1 of the rebalancing wizard (WeightsSumWarning component). It must not block the user from proceeding.

**Acceptance test:** Given target weights summing to 85%, when the user opens the rebalancing wizard Step 1, then the WeightsSumWarning displays "Your targets sum to 85%. The remaining 15% will be held as cash after rebalancing." and the Calculate button is not disabled.

---

### F1-R6 — Two Rounding Modes

The calculator offers two rounding modes, selectable per session:

**Partial Rebalance (default):**
- Buy orders round down — never overspend available cash.
- Sell orders round up — free up maximum cash.
- Residual drift: approximately ±1–2% (acceptable).
- One transaction per asset.
- No warning required.

**Full Rebalance:**
- Sells all relevant positions and re-buys to achieve exact target weights (±0.01% tolerance).
- Up to two transactions per asset (one sell, one buy).
- Persistent warning displayed: `"This mode may generate additional transactions and higher brokerage fees."`
- Accuracy guarantee: computed weights after execution within ±0.01% of target weights.

**Implementation constraint:** Mode selector in Step 1 is rendered as radio cards (not a dropdown). Full Rebalance warning is `FullRebalanceWarning` component, visible only when mode = 'full'.

**Acceptance test (Partial):** Given a silo with 10 holdings totalling $10,000 and target weights, when Partial Rebalance is calculated, then no buy order exceeds available cash after accounting for all sell proceeds.

**Acceptance test (Full):** Given the same silo, when Full Rebalance is calculated, then all computed post-execution weights are within ±0.01% of target weights.

---

### F1-R7 — Pre-Flight Balance Validation

Before presenting any order set to the user, the engine performs a pre-flight balance validation:
- Available cash must cover all buy orders.
- Available share quantity must cover all sell orders.

If validation fails, the API returns HTTP 422 with `balance_valid: false` and a `balance_errors` array describing the specific constraint(s) that failed. No orders are shown. The UI renders `BalanceErrorBanner` listing the specific errors.

**Acceptance test:** Given a silo with $100 cash and a rebalancing plan requiring $500 in purchases, when `POST /rebalance/calculate` is called, then the response is HTTP 422 with `balance_valid: false` and `balance_errors` containing at least one entry describing the shortfall.

---

### F1-R8 — Accuracy Targets

| Mode | Accuracy Target |
|---|---|
| Full Rebalance | ±0.01% of target weights |
| Partial Rebalance | Up to ±2% residual drift acceptable |

These are verified in the unit tests for the calculation engine, not just in manual testing.

---

### F1-R9 — Silo Isolation (Absolute)

All rebalancing calculations and order executions are strictly isolated to their respective platform silo. No cross-silo calculations, capital transfers, or order submissions are permitted.

**Implementation constraint:** Every calculation function takes `silo_id` as input and queries only rows where `silo_id = $1`. This must be unit tested with a two-silo scenario.

**Acceptance test:** Given two silos (A and B) with the same asset at different quantities, when rebalancing silo A, then the calculation uses only silo A's holdings, prices, and weights — silo B's data does not affect the result.

---

### F1-R10 — Immutable Session Blocks

Rebalancing sessions are stored as immutable session blocks. Each block captures a full snapshot of holdings, prices, and weights at the time of calculation in `snapshot_before` JSONB. Sessions are never modified after creation — any new rebalance creates a new session block.

**Implementation constraint:** There must be no `UPDATE` statements targeting `rebalance_sessions` in the codebase **except one**: `snapshot_after` is populated by a single `UPDATE` issued by the execute endpoint after Alpaca execution confirms all order results. For non-Alpaca and manual silos where execution is handled externally, `snapshot_after` remains `NULL` permanently — this is expected and valid. The `snapshot_before` field is written on `INSERT` (during calculate) and is never touched again.

**Why one UPDATE is permitted:** The calculate endpoint creates the session (`INSERT`) before the user approves. The execute endpoint runs in a separate HTTP request. By the time results are known (order IDs from Alpaca), the session row already exists. Populating `snapshot_after` in the same INSERT is architecturally impossible for Alpaca. This is the sole exception to CLAUDE.md Rule 9.

**Acceptance test:** After a rebalance session is created and executed, a direct database query `SELECT updated_at FROM rebalance_sessions WHERE id = $1` must return no row (the `updated_at` column must not exist — sessions have no `updated_at` by design).

---

## Non-Functional Requirements (Feature-Specific)

- Rebalancing calculation must complete in under 2 seconds for portfolios of up to 50 holdings.
- The ConfirmDialog must require an affirmative button press and must not be dismissible by clicking outside or pressing Escape.

---

## Glossary

| Term | Definition |
|---|---|
| Partial Rebalance | Rounding mode that minimises transactions; residual drift of ±1–2% expected |
| Full Rebalance | Rounding mode achieving exact target weights (±0.01%) at the cost of additional transactions |
| Sell-to-Buy | Strategy where sell proceeds fund purchases of underweight assets |
| Cash Injection | Optional additional deployable capital entered by the user per session |
| Pre-Flight Validation | Balance check before any orders are presented — fails fast if constraints are violated |
| snapshot_before | JSONB field capturing the complete state of holdings, prices, and weights at calculation time |
