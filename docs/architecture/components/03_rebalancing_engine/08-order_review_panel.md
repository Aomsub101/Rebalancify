# Sub-Component: Order Review Panel (Step 2)

## 1. The Goal

Display all calculated orders with a clear BUY/SELL summary, allow the user to skip individual orders, show any pre-flight errors that block execution, and trigger the non-dismissible `ConfirmDialog` before submitting.

---

## 2. The Problem It Solves

Users must review exactly what will happen before money moves. The review panel surfaces: the order list with quantities and values, which orders are buy vs sell, the net cash flow, and any errors that make execution impossible. The skip feature lets users exclude individual orders without recalculating.

---

## 3. The Proposed Solution / Underlying Concept

### OrdersTable

Columns: Ticker | Type badge | Quantity | Est. Value | Weight (before → after) | Skip checkbox

| Order Type | Badge Colour |
|---|---|
| BUY | `bg-positive-bg text-positive` (green) |
| SELL | `bg-negative-bg text-negative` (red) |

Non-colour signal: badges use uppercase text labels (BUY/SELL) in addition to colour.

### Skip Mechanism

```typescript
const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set())

function toggleSkip(id: string) {
  setSkippedIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
}

// Approved = orders not in skippedIds
const approvedOrderIds = orders.filter(o => !skippedIds.has(o.id)).map(o => o.id)
```

Skipped orders appear visually dimmed (`opacity-50`).

### ExecutionModeNotice

For non-Alpaca silos: an info banner explaining manual execution is required.

```typescript
{!isAlpaca && (
  <div role="note" aria-label="Manual execution required">
    <p>Manual execution required</p>
    <p>These orders will not be submitted automatically.
       After reviewing, you will execute them manually on {platformLabel}.</p>
  </div>
)}
```

### BalanceErrorBanner

Shown when `balance_valid === false`. Blocks the "Execute" button.

```typescript
{!balance_valid && (
  <div role="alert">
    <p>Insufficient balance for full rebalance</p>
    <ul>{balance_errors.map(msg => <li>{msg}</li>)}</ul>
  </div>
)}
```

### ConfirmDialog Trigger

```typescript
const canExecute = balance_valid && approvedOrderIds.length > 0

<button
  onClick={() => setConfirmOpen(true)}
  disabled={!canExecute}
>
  Execute orders →
</button>

<ConfirmDialog
  open={confirmOpen}
  onConfirm={() => executeOrders()}
  onCancel={() => setConfirmOpen(false)}
>
  {/* Shows: order count, platform, total estimated value */}
</ConfirmDialog>
```

### TanStack Query Invalidation (on success)

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['holdings', siloId] })
  queryClient.invalidateQueries({ queryKey: ['sessions', siloId] })
  queryClient.invalidateQueries({ queryKey: ['silos', siloId] })
}
```

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| BUY badge green, SELL badge red | Visual check |
| Skip dims row | Check skip → row has `opacity-50` |
| BalanceErrorBanner blocks Execute | Pre-flight failure → button disabled |
| ExecutionModeNotice for non-Alpaca | Open BITKUB silo → notice appears |
| ConfirmDialog non-dismissible | Click outside + press Escape → dialog stays |
| `pnpm build` | Compiles without errors |
