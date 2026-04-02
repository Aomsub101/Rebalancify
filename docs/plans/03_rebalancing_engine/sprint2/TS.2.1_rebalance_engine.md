# TS.2.1 — Rebalance Engine

## Task
Implement the pure rebalance calculation function with partial and full modes.

## Target
`lib/rebalanceEngine.ts`

## Inputs
- `docs/architecture/components/03_rebalancing_engine/02-rebalance_engine.md`

## Process
1. Create `lib/rebalanceEngine.ts` — pure function, no DB calls:
   - Input: holdings array, target weights, cash_balance, mode ('partial'|'full'), cash_included, cash_amount
   - **Partial mode (default):**
     - Process sells first
     - Buys funded by sell proceeds + optional cash injection
     - No buy exceeds available capital
     - Residual drift ≤ 2%
   - **Full mode:**
     - Each buy/sell sized to land within ±0.01% of target weight
     - Pre-flight: if `total_buy_cost > available_capital` → return `balance_valid: false` + `balance_errors[]`
   - Output: array of `{ asset_id, ticker, order_type ('buy'|'sell'), quantity, estimated_value, price_at_calc, weight_before_pct, weight_after_pct }`
2. No side effects — this is a pure calculation function
3. Used by the calculate route (TS.2.2)

## Outputs
- `lib/rebalanceEngine.ts`

## Tests
- Partial mode: total buy cost ≤ available capital
- Full mode: post-execution weights within ±0.01% of targets
- Pre-flight failure: insufficient cash → balance_valid: false
- Edge cases: single asset, all cash, zero drift

## Verify
- Unit tests pass for both modes
- No DB calls in the function

## Handoff
→ TS.2.2 (Calculate route)
