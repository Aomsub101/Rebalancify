# Sub-Component: Execution Result Panel (Step 3)

## 1. The Goal

Show the outcome of the rebalancing execution — per-order status for Alpaca silos (executed, skipped, failed) and copy-paste manual order instructions for non-Alpaca silos.

---

## 2. The Problem It Solves

After execution the user needs to know what actually happened. For Alpaca silos: which orders filled, which failed, which were skipped. For manual silos: the exact instructions to enter into each platform. The result panel closes the loop on the entire rebalancing workflow.

---

## 3. The Proposed Solution / Underlying Concept

### Alpaca Result View

Per-order status table:

| Status | Icon | Colour |
|---|---|---|
| `executed` | `CheckCircle` | `text-positive` |
| `skipped` | `MinusCircle` | `text-muted-foreground` |
| `failed` | `XCircle` | `text-negative` |

Summary counts shown as inline spans at the top of the panel.

### Manual Execution View

For non-Alpaca silos: renders a list of instruction strings the user can copy individually or all at once.

```typescript
function buildManualInstruction(order, platformLabel): string {
  const action = order.order_type === 'buy' ? 'Buy' : 'Sell'
  const qty = formatNumber(order.quantity, 'quantity', 'stock')
  return `${action} ${qty} share(s) of ${order.ticker} at market on ${platformLabel}.`
}
```

**Copy individual row:**
```typescript
<button onClick={() => navigator.clipboard.writeText(instruction)}>
  <Copy className="h-3.5 w-3.5" />
</button>
```

**Copy all:**
```typescript
function copyAllInstructions() {
  const text = manualOrders.map(o => buildManualInstruction(o, platformLabel)).join('\n')
  navigator.clipboard.writeText(text)
}
```

### Router Navigation After

```typescript
<button onClick={() => router.push(`/silos/${siloId}`)}>
  ← Back to silo
</button>
```

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Executed row shows CheckCircle | After successful Alpaca execute → green check visible |
| Failed row shows XCircle | After failed order → red X visible |
| Copy button works | Click copy → clipboard has correct instruction text |
| Copy all works | Click "Copy all" → all instructions in clipboard |
| "Back to silo" navigates | Click → URL changes to /silos/[id] |
| `pnpm build` | Compiles without errors |
