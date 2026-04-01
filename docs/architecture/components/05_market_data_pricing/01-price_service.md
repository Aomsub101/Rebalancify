# 01 — Price Service

## The Goal

Provide a single, cache-first function for fetching the current price of any asset — stocks, ETFs, and crypto — that all parts of the application call. The function must minimise external API calls by respecting a 15-minute TTL, route to the most authoritative price source, and gracefully degrade to stale cache when all external sources fail.

---

## The Problem It Solves

Without a unified price service, drift calculations, rebalancing, and broker sync would each call external APIs independently, multiplying rate-limit consumption and producing inconsistent prices within the same page load. A shared cache ensures all users and all components see the same price for a given asset within the TTL window.

---

## Implementation Details

**File:** `lib/priceService.ts`

**Primary function:** `fetchPrice(supabase, assetId, ticker, source, coingeckoId?)`

### Tier 1 — Cache Check

```typescript
const { data: cacheRow } = await supabase
  .from('price_cache_fresh')
  .select('*')
  .eq('asset_id', assetId)
  .single()

if (cacheRow?.is_fresh) {
  return { price: cacheRow.price, currency: cacheRow.currency,
           source: cacheRow.source, fromCache: true }
}
```

Queries the `price_cache_fresh` view, which computes `is_fresh = (NOW() - fetched_at) < INTERVAL '15 minutes'`. If `is_fresh`, returns immediately — zero external API calls.

### Tier 2 — External Fetch

**Source routing:**
- `source === 'finnhub'`: direct call to Finnhub
- `source === 'coingecko'`: direct call to CoinGecko
- `source === 'alpaca'`: routes to Finnhub (Alpaca has no standalone price API)
- `source === 'bitkub'`: routes to CoinGecko with `bitkub` as the recorded source

**Finnhub path:**
```
GET https://finnhub.io/api/v1/quote?symbol=<ticker>&token=<FINNHUB_API_KEY>
→ json.c  // current price
→ price = json.c.toFixed(8)
```

Throws `Error("Finnhub quote failed: <status>")` if non-ok, or `Error("Finnhub returned zero price for <ticker>")` if `json.c === 0`.

**CoinGecko path:**
```
GET https://api.coingecko.com/api/v3/simple/price?ids=<id>&vs_currencies=usd
→ json[id].usd
```

`coingeckoId` parameter defaults to `ticker.toLowerCase()` if not provided. Throws on non-ok or zero price.

### Tier 3 — Cache Write

After a successful external fetch, upserts into `price_cache` with `ON CONFLICT asset_id`:
```typescript
await supabase.from('price_cache').upsert({
  asset_id, price, currency: 'USD', source: actualSource,
  fetched_at: new Date().toISOString()
})
```

`source` is recorded as the actual API used (Finnhub or CoinGecko), not the original `source` parameter.

### Return Type

```typescript
interface PriceResult {
  price: string      // NUMERIC(20,8) as 8dp string, e.g. "185.20000000"
  currency: string   // 'USD'
  source: string     // actual API used
  fromCache: boolean
}
```

---

## Testing & Verification

| Check | Method |
|---|---|
| Fresh cache → no external API call | Unit test: mock Supabase to return `is_fresh: true` → verify no fetch |
| Stale cache → external API called | Unit test: mock `is_fresh: false` → verify Finnhub/CoinGecko called |
| `source = alpaca` routes to Finnhub | Unit test: call with `source: 'alpaca'` → verify Finnhub URL used |
| `source = bitkub` routes to CoinGecko | Unit test: call with `source: 'bitkub'` → verify CoinGecko URL used |
| Zero price from Finnhub → thrown | Unit test: mock Finnhub returning `c: 0` → verify error thrown |
| Cache upserted after external fetch | Integration test: call with cold cache → verify `price_cache` row inserted |
| Price returned as 8dp string | Manual: call for known ticker → verify price string format |
