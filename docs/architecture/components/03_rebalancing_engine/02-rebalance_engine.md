# Sub-Component: Rebalance Engine

## 1. The Goal

Provide a pure, deterministic, side-effect-free calculation function that takes a silo's current holdings and target weights and returns a precise set of buy/sell orders — with no DB calls, no API calls, and no reliance on anything outside the function signature.

---

## 2. The Problem It Solves

Order calculation must be:
- **Deterministic** — same inputs always produce same outputs (no `Date.now()`, no random)
- **Precise** — monetary values handled with `Decimal.js` to avoid floating-point errors
- **Isolated** — scoped strictly to the silo being calculated (silo B calc never affected by silo A)
- **Auditable** — a `snapshot_before` captures exact portfolio state at calculation time

---

## 3. The Proposed Solution / Underlying Concept

### Function Signature

```typescript
export function calculateRebalance(input: EngineInput): EngineResult

interface EngineInput {
  holdings: EngineHolding[]     // current positions
  weights: EngineWeight[]     // target weights
  mode: 'partial' | 'full'
  cashBalance: string         // NUMERIC(20,8) string, post-migration 23
}
```

### Partial Mode Algorithm

```
1. total = Σ(qty × price) + cashBalance
2. SELL overweight assets: ceil(delta_abs / price), capped at holding qty
3. Pool = existingCash + sellProceeds
4. BUY underweight assets: floor(pool_proportional), scaled if insufficient capital
```

**Key rounding:** Sell quantities use `ceil` (never sell more than owned). Buy quantities use `floor` (never buy more than capital allows). If capital is insufficient, all buy quantities are scaled proportionally down.

### Full Mode Algorithm

```
1. total = Σ(qty × price) + cashBalance
2. Cash target = 100 − sum(asset weights)
3. For each asset: delta = targetValue − currentValue
4. If cash excess (cash > target): buy underweight assets proportionally
5. If cash shortfall (cash < target): sell overweight assets proportionally
6. Round quantities half-up — no scaling; pre-flight validates capital sufficiency
```

**Pre-flight:** If after all calculations `totalBuyCost > availableCapital` → `balance_valid: false` and `balance_errors` array is populated. The API route returns HTTP 422 at this point without creating any DB records.

### Cash Target Concept

Post-migration 23, `cash_balance` lives on the silo (not per-holding). The engine treats cash as a first-class first citizen: `cash_target_pct = 100 - sum(weight_pct)`. A user with 60% total weight has an implicit 40% cash target.

### Snapshot Before

```typescript
interface EngineSnapshot {
  holdings: { asset_id, ticker, quantity, current_value, weight_pct }[]
  prices: Record<asset_id, price_string>
  weights: Record<asset_id, 3dp_float>
  total_value: string
}
```

Captured at calculation time, stored immutably in `rebalance_sessions.snapshot_before`. This is the single source of truth for "what the portfolio looked like before".

### Order Shape

```typescript
interface EngineOrder {
  asset_id: string
  ticker: string
  order_type: 'buy' | 'sell'
  quantity: string      // NUMERIC(20,8) string
  estimated_value: string
  price_at_calc: string
  weight_before_pct: number  // 3dp
  weight_after_pct: number   // 3dp
}
```

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Deterministic | Call twice with same input → identical orders array |
| Partial: no overspend | totalBuyCost ≤ availableCapital in all outputs |
| Full: ±0.01% accuracy | Post-execution weight - target ≤ 0.0001 |
| Weights ≠ 100% proceeds | weights_sum=70 → cash_target=30, no error |
| Empty holdings | All at target → orders=[], balance_valid=true |
| Silo isolation | Two silos same ticker, different qty → each engine call independent |
| `pnpm test` | `lib/rebalanceEngine.test.ts` passes |
