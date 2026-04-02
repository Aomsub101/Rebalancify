# TS.2.3 — Price Service

## Task
Implement the price fetch service with cache-first strategy (15-min TTL).

## Target
`lib/priceService.ts`

## Inputs
- `docs/architecture/components/05_market_data_pricing/01-price_service.md`
- `docs/architecture/02-database-schema.md` (price_cache, price_cache_fresh)

## Process
1. Create `lib/priceService.ts` with `fetchPrice(supabase, assetId, ticker, source, coingeckoId?)`:
   - **Tier 1 — Cache:** Query `price_cache_fresh` for asset_id. If `is_fresh = true`, return cached.
   - **Tier 2 — External fetch:**
     - `source === 'finnhub'` or `'alpaca'` → Finnhub `/quote?symbol={ticker}` → `json.c`
     - `source === 'coingecko'` or `'bitkub'` → CoinGecko `/simple/price?ids={id}&vs_currencies=usd`
   - **Tier 3 — Cache write:** Upsert into `price_cache` with fresh `fetched_at`
2. Response shape: `{ price: string, currency: string, source: string, fromCache: boolean }`
3. Handle API failures: return stale cache if available, otherwise error
4. All external calls are server-side only (API route handlers)

## Outputs
- `lib/priceService.ts`

## Verify
- Fresh cache → no external API call
- Stale cache → external call + cache update
- API failure → stale cache returned
- No browser-side external API calls

## Handoff
→ TS.2.4 (Silo detail page)
