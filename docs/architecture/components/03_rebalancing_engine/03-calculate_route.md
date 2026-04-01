# Sub-Component: Calculate Route

## 1. The Goal

Handle `POST /api/silos/:id/rebalance/calculate` — authenticate the user, fetch the silo's current holdings, prices, and target weights, run the pure calculation engine, and persist an immutable `rebalance_sessions` row with `status: 'pending'` and `snapshot_before`.

---

## 2. The Problem It Solves

The pure engine needs data. The calculate route fetches that data, calls the engine, and — if pre-flight passes — creates the session and order records in the database. This is the only endpoint that writes `rebalance_sessions` and `rebalance_orders` rows.

---

## 3. The Proposed Solution / Underlying Concept

### Flow

```
POST /api/silos/:id/rebalance/calculate
    │
    ├── Authenticate (createClient → getUser)
    ├── Verify silo ownership (RLS double-check)
    ├── Fetch holdings + asset tickers
    ├── Fetch target weights
    ├── Collect ALL asset IDs (holdings + weights-only)
    ├── Fetch cached prices
    ├── On-demand fetch for uncached assets (priceService.ts)
    ├── Build EngineInput
    ├── Call calculateRebalance()
    │
    ├── balance_valid === false → HTTP 422 with snapshot_before
    │
    └── balance_valid === true → INSERT rebalance_sessions + INSERT rebalance_orders
                                   → return orders + session_id
```

### Pre-flight: 422 Without DB Writes

If `result.balance_valid === false`, the function returns HTTP 422 **without inserting any rows**:

```typescript
return NextResponse.json({ session_id: null, ..., orders: result.orders }, { status: 422 })
```

### No `updated_at` on Sessions

```typescript
// WRONG — never do this:
{ ..., updated_at: new Date().toISOString() }

// CORRECT — no updated_at field at all:
{ silo_id, user_id, mode, weights_sum_pct, cash_target_pct,
  snapshot_before, status: 'pending', created_at }
```

### Price Fetch for Uncached Assets

```typescript
// Bug fix: Alpaca/Webull sync never cached prices
const missingIds = allAssetIds.filter(id => !priceMap.has(id) || priceMap.get(id) === '0')
for (const assetId of missingIds) {
  const result = await fetchPrice(supabase, assetId, ticker, source)
  priceMap.set(assetId, result.price)
  await supabase.from('price_cache').upsert({ asset_id: assetId, price: result.price, ... }, { onConflict: 'asset_id' })
}
```

### Weight-Only Assets

Assets that appear in `target_weights` but have no current holding are included with `quantity: '0.00000000'` — so the engine can compute BUY orders for assets the user wants to add to the portfolio.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| 422 without DB write on pre-flight failure | Mock insufficient capital → no `rebalance_sessions` INSERT in DB |
| Session INSERT with correct fields | Check DB after successful calculate → row with `status: pending` |
| `snapshot_before` is immutable | DB row has no `updated_at` column |
| Weight-only assets produce BUY orders | Add 20% AAPL weight to empty silo → BUY order generated |
| `pnpm test` | `app/api/silos/[silo_id]/rebalance/calculate/__tests__/route.test.ts` passes |
