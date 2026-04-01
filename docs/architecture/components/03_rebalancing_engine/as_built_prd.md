# Component 3 — Rebalancing Engine: As-Built PRD

> Reverse-engineered from implementation as of 2026-04-01. All facts derived from verified source files — no speculation.

---

## 1. The Goal

Compute precise buy/sell orders to bring a silo to its target weights, create an immutable audit snapshot of the portfolio before any changes, execute those orders against Alpaca (with paper/live modes), and present a 3-step wizard UI so the user reviews and approves every order before it is sent. Every allocation decision and trade execution is strictly the user's own choice.

---

## 2. The Problem It Solves

A self-directed investor needs to know exactly how many shares to buy or sell to reach their target allocation — and needs to trust that the system shows precisely what will happen before any money moves. Without an immutable session snapshot the "before" state is lost after execution. Without pre-flight validation a user could approve orders their account cannot cover. Without a non-dismissible confirm dialog a user could accidentally trigger execution.

---

## 3. The Proposed Solution / Underlying Concept

### Encrypted Alpaca Key Storage

AES-256-GCM encryption — a 32-byte `ENCRYPTION_KEY` lives only in Vercel environment variables. Each encrypted value stores a unique 12-byte IV alongside the ciphertext. Decryption happens server-side only, immediately before the Alpaca API call; plaintext is never logged or returned in any response.

### Holdings Sync

`POST /api/silos/:id/sync` for Alpaca silos fetches all positions from the Alpaca REST API (paper or live based on `alpaca_mode`), then upserts rows into `holdings`. All Alpaca API calls are server-side only — zero browser requests to `api.alpaca.markets`.

### Rebalancing Calculator

`lib/rebalanceEngine.ts` — pure function, no DB calls.

**Partial mode (default):** Sells processed first; buys funded by sell proceeds + optional cash injection. No buy exceeds available capital. Residual drift ≤ 2%.

**Full mode:** Each buy/sell sized to land within ±0.01% of target weight. Pre-flight validation: if `total_buy_cost > available_capital`, returns HTTP 422 with `balance_valid: false` and `balance_errors[]`.

**Immutability:** A `rebalance_sessions` row is created on `calculate` with `status: 'pending'` and `snapshot_before` (JSONB). The table has **no `updated_at` column** — sessions are append-only with two narrow permitted exceptions (F1-R10).

### Order Execution

`POST /api/silos/:id/rebalance/execute` is the only endpoint that submits to Alpaca. For Alpaca: decrypts credentials, submits market orders, stores `alpaca_order_id`, updates status to `'approved'` or `'partial'`, populates `snapshot_after`. For non-Alpaca silos: renders manual instructions.

### 3-Step Wizard

| Step | What Happens |
|---|---|
| **1 — Config** | Mode radio cards (partial/full), FullRebalanceWarning, WeightsSumWarning |
| **2 — Review** | OrdersTable with skip checkboxes, BalanceErrorBanner, ExecutionModeNotice |
| **3 — Result** | Per-order status (executed/skipped/failed), manual instruction copy |

ConfirmDialog is **non-dismissible** — no `onOpenChange`, clicking outside blocked, Escape key blocked.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Encryption round-trip | Unit test: encrypt → decrypt → original value |
| Zero browser requests to Alpaca | DevTools Network: no `alpaca.markets` requests during sync/execute |
| Partial mode — no overspend | Unit test: total buy cost ≤ available capital |
| Full mode — ±0.01% accuracy | Unit test: post-execution weights within ±0.01% of targets |
| Pre-flight failure | Insufficient cash → HTTP 422 with `balance_valid: false` |
| ConfirmDialog non-dismissible | Click outside + Escape → dialog stays open |
| No UPDATE on rebalance_sessions | `grep 'UPDATE.*rebalance_sessions'` → zero results (except execute endpoint) |
| RLS cross-user isolation | User B cannot GET User A's rebalance history |

---

## 5. Integration

### Sub-Components

| Sub-Component | File |
|---|---|
| Encryption Utility | `01-encryption.md` |
| Rebalance Engine (pure function) | `02-rebalance_engine.md` |
| Calculate Route | `03-calculate_route.md` |
| Execute Route | `04-execute_route.md` |
| Rebalance History | `05-rebalance_history.md` |
| Wizard Orchestrator | `06-rebalance_wizard_view.md` |
| Config Panel (Step 1) | `07-config_panel.md` |
| Order Review Panel (Step 2) | `08-order_review_panel.md` |
| Execution Result Panel (Step 3) | `09-execution_result_panel.md` |
| ConfirmDialog | `10-confirm_dialog.md` |
| Alpaca Sync | `11-alpaca_sync.md` |

### Consumed From
- **Component 2 — Portfolio Data Layer** — holdings, prices, weights, FX rates
- **Component 1 — Auth & Foundation** — AppShell, SessionContext, `lib/supabase/server.ts`

### Feeds Into
- **Component 2 — Portfolio Data Layer** — writes `rebalance_sessions` and `rebalance_orders` rows
- **Component 1 — Auth** — `AlpacaLiveBadge` consumed by AppShell and SiloCard
