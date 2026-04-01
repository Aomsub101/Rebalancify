# Sub-Component: Execute Route

## 1. The Goal

Handle `POST /api/silos/:id/rebalance/execute` — the only endpoint that submits real orders to Alpaca. Reads the session, submits approved orders, stores results, and updates session status.

---

## 2. The Problem It Solves

The calculate endpoint creates the session; the execute endpoint completes the cycle by actually moving money. It must: decrypt credentials server-side, submit market orders to Alpaca, track per-order success/failure, determine session-level status, and populate `snapshot_after` — the sole permitted UPDATE exception to session immutability.

---

## 3. The Proposed Solution / Underlying Concept

### Flow

```
POST /api/silos/:id/rebalance/execute
    │
    ├── Authenticate
    ├── Verify session ownership + status === 'pending'
    │
    ├── ─── Alpaca silos ───
    │   ├── Decrypt alpaca_key_enc + alpaca_secret_enc
    │   ├── Select base URL (paper-api or live)
    │   ├── For each approved order:
    │   │   POST /v2/orders to Alpaca
    │   │   → success: UPDATE order with alpaca_order_id + executed_at
    │   │   → failure: UPDATE order with execution_status: 'failed'
    │   └── UPDATE session: status = 'approved' | 'partial', snapshot_after
    │
    └── ─── Non-Alpaca silos ───
        └── UPDATE orders: execution_status: 'manual'
            UPDATE session: status: 'approved'
```

### Status Machine

| Condition | Final Status |
|---|---|
| `approved_order_ids` is empty | `cancelled` |
| All approved orders succeed | `approved` |
| At least one approved order fails | `partial` |
| All non-skipped orders are manual | `approved` |

### Alpaca API Calls Are Server-Side Only

```typescript
// Zero browser requests to alpaca.markets — all done here
const res = await fetch(`${baseUrl}/v2/orders`, {
  method: 'POST',
  headers: { 'APCA-API-KEY-ID': keyId, 'APCA-API-SECRET-KEY': secretKey },
  body: JSON.stringify({ symbol: ticker, qty: quantity, side, type: 'market', time_in_force: 'day' }),
})
```

### Permitted UPDATE Exception (F1-R10)

```typescript
// F1-R10 sole permitted UPDATE: status + snapshot_after for Alpaca execution
await supabase
  .from('rebalance_sessions')
  .update({ status: sessionStatus, snapshot_after: { executed_at: executedAt } })
  .eq('id', session_id)
  .eq('user_id', user.id)
```

### Manual Silos

Instead of submitting to Alpaca, the endpoint marks approved orders as `execution_status: 'manual'` and sets session status to `'approved'`. The `ExecutionResultPanel` then shows copy-pasteable manual instructions.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Zero browser requests to Alpaca | Network tab: no `alpaca.markets` requests during execute |
| Decryption happens server-side | `alpaca_key_enc` never appears in response body |
| Partial status on one failure | One order fails → session status = `'partial'` |
| Manual orders get `execution_status: 'manual'` | Execute for BITKUB silo → orders have `'manual'` |
| No UPDATE except for status + snapshot_after | `grep` for `rebalance_sessions` UPDATE → only this route matches |
| `pnpm test` | `app/api/silos/[silo_id]/rebalance/execute/__tests__/route.test.ts` passes |
