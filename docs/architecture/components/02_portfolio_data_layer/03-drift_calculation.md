# Sub-Component: Drift Calculation

## 1. The Goal

Compute per-asset drift — the percentage deviation between an asset's current weight in a silo and its user-defined target weight — in real time on every request, with a three-state visual classification (green/yellow/red) that signals urgency.

---

## 2. The Problem It Solves

Investors need to know at a glance which assets have drifted far enough to warrant a rebalancing trade. Without live drift computation, users would see stale or manual calculations. The three-state threshold system gives a clear, actionable signal: "fine", "watch", "action needed".

---

## 3. The Proposed Solution / Underlying Concept

### GET /api/silos/:id/drift

**Algorithm (computed live, no historical storage):**

```
For each holding in silo:
  current_value  = quantity × cached_price
  total_value    = SUM(holding_values) + cash_balance
  current_weight_pct = (current_value / total_value) × 100
  target_weight_pct  = target_weights[asset_id] (or 0 if no target)
  drift_pct          = current_weight_pct - target_weight_pct
```

All calculations use `Decimal.js` (not JavaScript `number`) to avoid floating-point errors on monetary values.

**On-demand price fetch:** If an asset has no entry in `price_cache`, `fetchPrice()` is called inline to populate the cache (Bug fix: Alpaca/Webull sync never cached prices).

### Three-State Classification

Uses `computeDriftState(driftPct, threshold)`:

```
ABS(drift_pct) <= threshold           → 'green'  (within tolerance)
threshold < ABS(drift_pct) <= threshold + 2  → 'yellow' (watch)
ABS(drift_pct) > threshold + 2        → 'red'    (action needed)
```

`drift_breached = ABS(drift_pct) > threshold` (true for both yellow and red).

### DriftBadge Component (`components/shared/DriftBadge.tsx`)

Renders the three-state icon + label:

| State | Colour | Icon | Non-Colour Signal |
|---|---|---|---|
| green | `text-positive` | `Circle` | `aria-label="Within threshold"` |
| yellow | `text-warning` | `Triangle` | `aria-label="Near threshold"` |
| red | `text-negative` | `AlertCircle` | `aria-label="Breached threshold"` |

Rule 13 compliance: every drift badge includes an icon AND text AND `aria-label`.

### Response Shape

```typescript
{
  silo_id: string
  drift_threshold: number
  computed_at: string        // ISO timestamp — always live
  assets: [{
    asset_id: string
    ticker: string
    current_weight_pct: number   // 3dp
    target_weight_pct: number     // 3dp
    drift_pct: number             // signed, 3dp
    drift_state: 'green' | 'yellow' | 'red'
    drift_breached: boolean
  }]
}
```

### GlobalDriftBanner (Overview Page)

Shown when `any asset across all silos has drift_breached === true`. Displays a banner listing all breached tickers with their drift values.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Green at exactly threshold | threshold=5, drift=5 → green |
| Yellow at threshold+1 | threshold=5, drift=6 → yellow |
| Red at threshold+3 | threshold=5, drift=8 → red |
| Zero holdings returns empty assets | `GET /api/silos/:id/drift` with no holdings → `{ assets: [] }` |
| Drift with no target weight | target=0 → drift = current_weight_pct |
| `pnpm test` | `app/api/silos/[silo_id]/drift/__tests__/route.test.ts` passes |
