# TS.1.1 — Price Service Core

## Task
Implement the core price fetching service with cache-first strategy and multi-source support.

## Target
`lib/priceService.ts`

## Inputs
- `docs/architecture/components/05_market_data_pricing/01-price_service.md`

## Process
1. Create `lib/priceService.ts` with `fetchPrice(supabase, assetId, ticker, source, coingeckoId?)`:
   - **Tier 1 — Cache:** Query `price_cache_fresh` view. If `is_fresh = true`, return cached price.
   - **Tier 2 — External fetch by source:**
     - `finnhub` / `alpaca` → Finnhub `GET /api/v1/quote?symbol={ticker}` → `json.c`
     - `coingecko` / `bitkub` → CoinGecko `GET /api/v3/simple/price?ids={id}&vs_currencies=usd`
   - **Tier 3 — Cache write:** Upsert into `price_cache` with fresh `fetched_at`
2. Response: `{ price: string, currency: string, source: string, fromCache: boolean }`
3. Error handling: API failure → return stale cache if available, else throw
4. Rate limit handling: Finnhub 429 → return stale cache, log warning
5. All calls server-side only — never from browser

## Outputs
- `lib/priceService.ts`

## Tests
- Cache hit → no external call
- Cache miss → external call + cache write
- API failure → stale cache returned
- Rate limit → graceful fallback

## Handoff
→ TS.1.2 (price_cache migration)
