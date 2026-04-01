# Sub-Component: Config Panel (Step 1)

## 1. The Goal

Allow the user to configure rebalancing parameters before calculation — choosing between partial and full mode, and optionally injecting additional cash — then triggering the calculate API call.

---

## 2. The Problem It Solves

Users need to explicitly choose how aggressively to rebalance. Partial mode is the safe default (avoids overspending); full mode追求精确 but requires sufficient capital. Showing both options as radio cards — not a dropdown — makes the tradeoffs visually clear at a glance.

---

## 3. The Proposed Solution / Underlying Concept

### Mode Selection: Radio Cards

Two large clickable cards rendered as `role="radio"` elements (not a `<select>`):

| Field | Partial Mode | Full Mode |
|---|---|---|
| Description | Minimise trades — sells first, then buys within available cash | Exact target weights — requires sufficient cash |
| Residual drift | ±1–2% possible | ±0.01% accuracy |
| Capital requirement | Always satisfiable (partial fills) | May fail pre-flight if insufficient |

### FullRebalanceWarning

Shown only when `mode === 'full'`:

> "Full rebalance requires available cash. All buy orders will be calculated to reach exact target weights. If your cash balance is insufficient, the calculation will return a preflight error."

Displayed as a `role="alert"` with amber border and background.

### WeightsSumWarning

Shown when `weights_sum_pct !== 100`:

> "Target weights sum to X%. The remaining Y% is treated as a cash target."

Rendered via `<WeightsSumWarning>` component from `components/silo/WeightsSumWarning.tsx`.

### Offline Guard

The "Calculate orders" button is disabled when `isOnline === false` (from `useOnlineStatus` hook). A tooltip explains "Unavailable offline" on hover.

```typescript
<button disabled={isCalculating || !isOnline}>
  {isCalculating ? 'Calculating…' : 'Calculate orders'}
</button>
```

### API Call

```typescript
const res = await fetch(`/api/silos/${siloId}/rebalance/calculate`, {
  method: 'POST',
  body: JSON.stringify({ mode }),
})
const data = await res.json()
onCalculated(data as CalculateResponse)
```

Accepts HTTP 422 (pre-flight failure) as a non-error response — the result is passed to Step 2 so the `BalanceErrorBanner` can display the shortfall.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Radio card selected state | Click "Full" → card has `border-primary` and filled radio dot |
| FullRebalanceWarning shown only in full mode | Select partial → warning hidden; select full → warning appears |
| WeightsSumWarning shown when sum ≠ 100 | Pass `initialWeightsSum=70` → warning appears with "70%" |
| Offline → button disabled | DevTools Network offline → button greyed, tooltip visible |
| 422 accepted as valid response | Pre-flight failure → HTTP 422 → passed to Step 2 |
| `pnpm build` | Compiles without errors |
