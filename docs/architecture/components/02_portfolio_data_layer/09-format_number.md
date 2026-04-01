# Sub-Component: Format Number Utility

## 1. The Goal

Centralize all numeric display formatting in one utility function — `formatNumber()` — so that prices, weights, drift values, quantities, and staleness labels are formatted consistently throughout the application and never formatted inline in components.

---

## 2. The Problem It Solves

Without a shared formatter, different developers on different pages would format the same type of value differently: prices sometimes show 2dp, sometimes 4dp; quantities sometimes show trailing zeros, sometimes not. A single `formatNumber()` function enforces consistency and makes it trivial to change a format across the entire app.

---

## 3. The Proposed Solution / Underlying Concept

### Function Signature

```typescript
export function formatNumber(
  value: string | number,
  type: 'price' | 'weight' | 'weight-input' | 'drift' | 'quantity' | 'staleness' | 'age',
  context?: PriceContext | QuantityContext
): string
```

### Format Types

| Type | Output | Example |
|---|---|---|
| `price` (USD) | `$1,234.56` | `formatNumber('1234.56', 'price')` |
| `price` (THB) | `฿1,234.56` | `formatNumber('1234.56', 'price', 'THB')` |
| `weight` | `14.82%` | Always 2dp with `%` suffix |
| `weight-input` | `14.820` | 3dp, no grouping, for form inputs |
| `drift` | `+2.35%` or `-2.35%` | Signed, 2dp, always shows sign |
| `quantity` (stock) | `100` or `12.3456` | Integers at 0dp; max 4dp fractional |
| `quantity` (crypto) | `0.12345678` | Always 8dp for crypto |
| `staleness` | `today`, `1 day ago`, `5 days ago` | Human-readable relative age |
| `age` | `< 1 Day`, `30 Days`, `6 Months`, `2 Years` | Portfolio/silo age display |

### Edge Cases

```typescript
// Non-finite values (NaN, Infinity) → '—'
Number.isFinite(parseFloat(value))  // false → return '—'

// Quantity: integers shown without decimal places
Number.isInteger(num) || num % 1 === 0  // true → String(Math.round(num))

// Drift: Math.abs used for display, sign prepended
return num >= 0 ? `+${fixed}%` : `-${fixed}%`
```

### context Parameter

- `context: 'THB'` → currency prefix `฿` instead of `$`
- `context: 'crypto'` → 8dp for quantity (vs 0–4dp for stocks)

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| `formatNumber(1234.5, 'price')` | Returns `$1,234.50` |
| `formatNumber(14.820, 'weight')` | Returns `14.82%` |
| `formatNumber(-3.5, 'drift')` | Returns `-3.50%` |
| `formatNumber(100, 'quantity')` | Returns `100` (no decimal) |
| `formatNumber(NaN, 'price')` | Returns `—` |
| `formatNumber(0, 'staleness')` | Returns `today` |
| `formatNumber(0, 'age')` | Returns `< 1 Day` |
| `pnpm test` | `lib/formatNumber.test.ts` passes |
