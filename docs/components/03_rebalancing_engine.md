# Component 3 — Rebalancing Engine

## 1. The Goal

Compute precise buy/sell orders to bring a silo to its target weights, create an immutable audit snapshot of the portfolio before any changes, execute those orders against Alpaca (with paper/live modes), and present the full 3-step wizard UI so the user reviews and approves every order before it is sent. This is the computational and executional heart of Rebalancify — every allocation decision and trade execution is strictly the user's own choice.

---

## 2. The Problem It Solves

A self-directed investor needs to know exactly how many shares to buy or sell to reach their target allocation — and needs to trust that the system is showing them precisely what will happen before any money moves. Without:

- An immutable session snapshot, the "before" state is lost after execution, making audit impossible
- Pre-flight validation, a user could approve orders that their account cannot cover
- A non-dismissible confirm dialog, a user could accidentally trigger execution by clicking outside the dialog
- A deterministic calculator, two runs of the same portfolio could produce different results

---

## 3. The Proposed Solution / Underlying Concept

### Encrypted Alpaca Key Storage (STORY-009)

Alpaca API keys are stored encrypted in `user_profiles.alpaca_key_enc` and `user_profiles.alpaca_secret_enc`. The encryption scheme (from `lib/encryption.ts`) is **AES-256-GCM**:

- A cryptographically random 32-byte `ENCRYPTION_KEY` is stored in Vercel environment variables (never in the codebase or committed to git)
- Each value is encrypted with a unique 12-byte IV stored alongside the ciphertext
- Decryption happens server-side only, immediately before the Alpaca API call, and the plaintext is never written to logs or returned in any API response

After keys are saved, `alpaca_mode` (`'paper'` | `'live'`) is also stored. When `alpaca_mode = 'live'`, an amber `AlpacaLiveBadge` ("LIVE") appears on the silo card and silo detail header — it cannot be hidden.

### Holdings Sync (STORY-009)

`POST /api/silos/:id/sync` for an Alpaca silo fetches all positions from the Alpaca REST API (paper-api or live API based on `alpaca_mode`), then upserts rows into the `holdings` table. `last_synced_at` is recorded. All Alpaca API calls are server-side only — zero browser requests to `api.alpaca.markets` or `paper-api.alpaca.markets`.

### Rebalancing Calculator (STORY-010, STORY-010b)

`lib/rebalanceEngine.ts` is the core calculation engine. It is called by `POST /api/silos/:id/rebalance/calculate`.

**Partial Mode** (default):
- Sell orders are processed first; buy orders are funded by sell proceeds plus optional cash injection
- No buy order exceeds available capital (pre-flight validation enforced)
- Residual drift after execution is ≤ 2% of portfolio value

**Full Mode**:
- Each buy/sell is sized to land within ±0.01% of the target weight
- Higher precision than partial mode; may require larger total trades

**Pre-flight Validation**:
- Before returning the session, the engine checks: `total_sell_proceeds + optional_cash >= total_buy_cost`
- If insufficient: returns HTTP 422 with `balance_valid: false` and `balance_errors[]` describing the shortfall

**Cash Injection**:
- `include_cash: true, cash_amount: "500.00000000"` adds that amount to available capital before calculation

**Immutability**:
- A `rebalance_sessions` row is created on `calculate` with `status: 'pending'` and `snapshot_before` (JSONB snapshot of all holdings at that moment)
- The `rebalance_sessions` table has **no `updated_at` column** — sessions are append-only

### Session Creation & Calculation Response (STORY-010)

```typescript
// POST /api/silos/:id/rebalance/calculate
{
  session_id: uuid,
  mode: "partial" | "full",
  balance_valid: boolean,
  balance_errors: string[],        // only present when balance_valid = false
  orders: [{
    ticker: string,
    side: "buy" | "sell",
    quantity: string,               // shares (numeric string)
    estimated_value: string,       // USD (numeric string)
    current_weight_pct: string,
    target_weight_pct: string,
    skip: boolean
  }],
  snapshot_before: { holdings: [...] },  // JSONB, immutable
  weights_sum_pct: string,
  cash_target_pct: string,
  sum_warning: boolean
}
```

### Order Execution (STORY-011)

`POST /api/silos/:id/rebalance/execute` is the only endpoint that submits orders to Alpaca.

**Alpaca Execution:**
1. Validates `CRON_SECRET` or session ownership
2. Reads the `rebalance_sessions` row (status must be `'pending'`)
3. For each order where `skip = false`: submits a market order to Alpaca API
4. On success: stores `alpaca_order_id` on the `rebalance_orders` row
5. Updates session `status: 'pending'` → `'approved'` (all orders filled) or `'partial'` (some failed)
6. Populates `snapshot_after` with holdings state after execution
7. No `updated_at` is used — only the two narrow exceptions documented in the schema

**Manual Silo Execution:**
- Same endpoint, but instead of submitting to Alpaca, renders a readable instruction set for the user to execute manually
- `ExecutionModeNotice` shown in the wizard for non-Alpaca silos

### 3-Step Wizard UI (STORY-011b)

The rebalancing wizard lives at `/silos/[silo_id]/rebalance` and uses a `StepIndicator`:

| Step | What Happens |
|---|---|
| **1 — Config** | Mode radio cards (partial/full), cash injection toggle + amount, `FullRebalanceWarning`, `WeightsSumWarning` |
| **2 — Review** | `OrdersTable` with `OrderRow` (ticker, BUY/SELL badge, qty, value, weight arrow, skip checkbox), `BalanceErrorBanner` (if `balance_valid: false`), `ExecutionModeNotice` (non-Alpaca silos) |
| **3 — Result** | Per-order status (`executed ✓`, `skipped`, `failed`), total counts |

The "Execute orders" button opens a **non-dismissible `ConfirmDialog`** — no `onOpenChange` handler, no clicking outside to close, no Escape key. Only explicit Cancel or Confirm buttons close it. This is enforced by CLAUDE.md Rule 10.

After execution, TanStack Query cache is invalidated for `['holdings', siloId]` and `['sessions', siloId]`.

### Rebalance History (STORY-012)

`GET /api/silos/:id/rebalance/history` — paginated sessions for one silo, newest first
`GET /api/rebalance/history` — sessions across all user's silos

Sessions are **append-only with two narrow exceptions** (snapshot_after write and status transition by the execute endpoint). Grepping for `UPDATE.*rebalance_sessions` on any other column must return zero results. The RLS policy permits service-role UPDATE for the two exceptions but blocks user-level UPDATE entirely.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Encryption round-trip | Unit test: encrypt → decrypt → original value; wrong key throws |
| IV uniqueness | Unit test: encrypt same value twice → different ciphertexts |
| Key never in response | `grep` for `alpaca_key` or `_enc` in any GET response body → zero hits |
| Zero browser requests to Alpaca | DevTools Network tab: no requests to `alpaca.markets` during sync or execute |
| Partial mode — no overspend | Unit test: total buy cost ≤ available capital |
| Full mode — ±0.01% accuracy | Unit test: post-execution weights within ±0.01% of targets |
| Silo isolation | Unit test: two silos with same ticker, different quantities → silo B calc unaffected by silo A |
| Pre-flight failure | Unit test: insufficient cash → HTTP 422, `balance_valid: false`, `balance_errors` populated |
| Cash injection | Unit test: `include_cash: true, cash_amount: "500"` → cash added to available capital |
| Weights ≠ 100% | Unit test: proceeds normally, `cash_target_pct` correctly computed |
| Empty orders | Unit test: all assets at target → `orders: []`, `balance_valid: true` |
| 50 holdings < 2s | Timing assertion in unit test |
| ConfirmDialog non-dismissible | Manual: click outside + press Escape → dialog stays open |
| `ExecutionModeNotice` non-Alpaca | Manual: open wizard for a manual silo → notice appears, non-dismissible |
| No UPDATE on rebalance_sessions | `grep 'UPDATE.*rebalance_sessions'` → zero results (except execute endpoint's two narrow exceptions) |
| RLS: cross-user history | Two-user test: User B cannot GET User A's rebalance history |
| Session immutability | Verify `snapshot_before` never modified after INSERT |

---

## 5. Integration

### API Routes

| Method + Path | What It Does |
|---|---|
| `PATCH /api/profile` | Encrypts and stores `alpaca_key` and `alpaca_secret` |
| `POST /api/silos/:id/sync` | Alpaca positions fetch → upsert holdings |
| `POST /api/silos/:id/rebalance/calculate` | Creates immutable session, returns orders |
| `POST /api/silos/:id/rebalance/execute` | Submits to Alpaca or renders manual instructions; populates `snapshot_after` and status |
| `GET /api/silos/:id/rebalance/history` | Paginated per-silo session history |
| `GET /api/rebalance/history` | Cross-silo session history |

### Database Tables

| Table | Role |
|---|---|
| `rebalance_sessions` | Immutable audit record; `status: 'pending' | 'approved' | 'partial' | 'cancelled'` |
| `rebalance_orders` | Per-order record; `alpaca_order_id` stored after execution |
| `user_profiles` | Stores `alpaca_key_enc`, `alpaca_secret_enc`, `alpaca_mode` |

### Key Libraries

| File | Responsibility |
|---|---|
| `lib/encryption.ts` | AES-256-GCM encrypt/decrypt for API key storage |
| `lib/rebalanceEngine.ts` | Deterministic order calculation (partial + full mode) |

### Feeds Into

| Component | How |
|---|---|
| **Component 2 — Portfolio Data Layer** | Writes `rebalance_sessions` and `rebalance_orders` rows |
| **Component 4 — Broker Integration** | Reuses the execute pattern for BITKUB, Schwab, etc. (v2.0) |
| **Component 1 — Auth** | `AlpacaLiveBadge` consumed by AppShell and SiloCard |

### Consumed From

| Component | What It Provides |
|---|---|
| **Component 2 — Portfolio Data Layer** | Holdings, prices, target weights, FX rates (via `lib/priceService.ts`) |
| **Component 1 — Auth & Foundation** | AppShell, SessionContext, `lib/supabase/server.ts` |

### UI Components

| Component | Where Used |
|---|---|
| `components/rebalance/RebalanceConfigPanel.tsx` | Step 1 of wizard |
| `components/rebalance/OrderReviewPanel.tsx` | Step 2 of wizard |
| `components/rebalance/ExecutionResultPanel.tsx` | Step 3 of wizard |
| `components/shared/ConfirmDialog.tsx` | Non-dismissible execution confirmation |
| `components/shared/AlpacaLiveBadge.tsx` | Silo card + detail header (live mode only) |
| `components/shared/FullRebalanceWarning.tsx` | Config panel (full mode only) |
| `components/shared/WeightsSumWarning.tsx` | Config panel + silo detail |
| `components/shared/BalanceErrorBanner.tsx` | Review panel (pre-flight failure) |
| `components/shared/ExecutionModeNotice.tsx` | Review panel (non-Alpaca silos) |
