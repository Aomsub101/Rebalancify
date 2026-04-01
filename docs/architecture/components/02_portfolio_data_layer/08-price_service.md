# Sub-Component: Price Service

## 1. The Goal

Provide a single, authoritative price-fetching function (`fetchPrice`) used across the entire application that checks the price cache first, falls back to external APIs only when needed, and always writes fresh prices back to the cache — eliminating redundant network calls.

---

## 2. The Problem It Solves

Multiple parts of the application (holdings display, drift calculation, overview grid) need current prices. Without a shared service, each would independently call Finnhub or CoinGecko, hammering rate limits and returning inconsistent prices within the same page load. A three-tier fetching strategy ensures prices are consistent, fast, and always fresh within a 15-minute window.

---

## 3. The Proposed Solution / Underlying Concept

### Three-Tier Fetching Strategy

```
Tier 1: Check price_cache_fresh view
         ↓ (if not fresh)
Tier 2: Call external API (Finnhub or CoinGecko)
         ↓ (always after Tier 2)
Tier 3: Upsert result into price_cache
```

### Tier 1: `price_cache_fresh` View

A database view that marks a cached price as fresh if `fetched_at` is within the last 15 minutes:

```sql
price_cache_fresh AS
  SELECT *,
    fetched_at > NOW() - INTERVAL '15 minutes' AS is_fresh
  FROM price_cache
```

If `is_fresh = true` → return cached price immediately, zero external API calls.

### Tier 2: External API Calls

**Finnhub** (stocks/ETFs):
```typescript
const url = `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_API_KEY}`
const json = await fetch(url).then(r => r.json())
// Uses .c (current price) field
price = json.c.toFixed(8)
if (json.c === 0) throw new Error('Zero price')
```

**CoinGecko** (crypto):
```typescript
const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`
const json = await fetch(url).then(r => r.json())
price = json[id].usd.toFixed(8)
if (!rawPrice) throw new Error('Missing price')
```

### Price Source Resolution

```typescript
const actualSource: 'finnhub' | 'coingecko' =
  source === 'alpaca' ? 'finnhub' :
  source === 'bitkub' ? 'coingecko' :
  source
```

### Return Type

```typescript
interface PriceResult {
  price: string      // "185.20000000" — 8dp string
  currency: string   // "USD"
  source: string    // which API was called
  fromCache: boolean // true if Tier 1 was used
}
```

### Usage Points

- `POST /api/silos/:id/asset-mappings` — caches price after ticker confirmation
- `GET /api/silos/:id/drift` — on-demand fetch for uncached assets
- `GET /api/silos` — computes `total_value` per silo

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Fresh cache → no external API call | Set `fetched_at` to 5 min ago → Finnhub not called |
| Stale cache → external API called | Set `fetched_at` to 20 min ago → Finnhub called once |
| Upsert after external fetch | Finnhub returns price → `price_cache` row upserted |
| Zero price → throws | Finnhub returns `c: 0` → Error thrown |
| CoinGecko fallback | `source=bitkub` → CoinGecko API called |
| `pnpm test` | `lib/priceService.test.ts` (if present) passes |
