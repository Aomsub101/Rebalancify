# Sub-Component: Asset Search & Mapping

## 1. The Goal

Allow users to search for assets by ticker or name and confirm their identity before adding them to a silo — preventing mis-typed tickers from entering the portfolio and ensuring every holding has a validated price source.

---

## 2. The Problem It Solves

Users may not know the exact ticker for an asset. A search-as-you-type interface backed by Finnhub (stocks/ETFs) or CoinGecko (crypto) surfaces correct tickers. The confirmation step creates a permanent `asset_mappings` record that prevents duplicate or misspelled tickers from being added to the same silo.

---

## 3. The Proposed Solution / Underlying Concept

### Database Table: `asset_mappings`

```sql
asset_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  silo_id UUID NOT NULL REFERENCES silos(id),
  asset_id UUID NOT NULL REFERENCES assets(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(silo_id, asset_id)   -- same ticker cannot be added twice to same silo
)
```

The same ticker can exist in multiple silos (each with its own mapping), but never twice in the same silo.

### GET /api/assets/search

Routes to the appropriate provider based on `type` query param:

```typescript
// ?q=AAPL&type=stock|etf  → Finnhub /search
// ?q=bitcoin&type=crypto   → CoinGecko /search
```

**Finnhub response mapping:**
```typescript
{ results: [{ symbol, description }] }
```

**CoinGecko response mapping:**
```typescript
{ coins: [{ id, symbol, name }] }
```

### POST /api/silos/:id/asset-mappings

Creates a permanent mapping for the confirmed `(silo_id, asset_id)` pair:

1. Validate the asset exists in `assets` table
2. Check `UNIQUE(silo_id, asset_id)` constraint
3. If duplicate → HTTP 409 `{ error: { code: 'ASSET_MAPPING_EXISTS', message: '...' } }`
4. Insert mapping row
5. Call `fetchPrice()` to populate `price_cache` for this asset
6. Return the created mapping

### Duplicate Ticker Guard (Same Silo)

```typescript
// HTTP 409 — attempting to add AAPL to a silo that already has AAPL
if (duplicateAssetMapping) {
  return NextResponse.json(
    { error: { code: 'ASSET_MAPPING_EXISTS', message: 'This ticker is already in this silo' } },
    { status: 409 }
  )
}
```

### Same Ticker, Different Silos — Allowed

A user with two Alpaca silos can have AAPL in both. Each gets its own `asset_mappings` row with a different `silo_id`.

### After Mapping: Price Cached

`fetchPrice()` is called immediately after a mapping is created, so the holding's first price is available without waiting for the next cache refresh cycle.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Stock search → Finnhub called | Search AAPL → Finnhub API request observed |
| Crypto search → CoinGecko called | Search bitcoin → CoinGecko API request observed |
| Duplicate in same silo → 409 | Add AAPL → add AAPL again → HTTP 409 |
| Same ticker in different silos → OK | Add AAPL to Silo 1 → add AAPL to Silo 2 → both succeed |
| Price cached after mapping | POST mapping → `price_cache` row created |
| `pnpm test` | `app/api/silos/[silo_id]/asset-mappings/__tests__/route.test.ts` passes |
