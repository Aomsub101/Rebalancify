# TS.2.2 — Top Movers Route

## Task
Implement GET /api/market/top-movers returning top 5 gainers and losers for stocks or crypto.

## Target
`app/api/market/top-movers/route.ts`

## Inputs
- `docs/architecture/components/05_market_data_pricing/06-top_movers.md`

## Process
1. Create `app/api/market/top-movers/route.ts`:
   - Query param: `type=stocks|crypto`
   - **Stocks:**
     - Primary: FMP `/gainers` + `/losers`
     - Fallback: Finnhub `/scan/technical-indicator` sorted by percent_change
     - Final fallback: stale price_cache with `change_pct = 0`
   - **Crypto:**
     - CoinGecko `/coins/markets` sorted by `price_change_percentage_24h` desc/asc
2. Response: `{ type, stale, fetched_at, gainers: [...], losers: [...] }`
   - Each item: `{ ticker, name, price, change_pct }`
3. Stale-cache fallback: if all external sources fail, return last cached with `stale: true`

## Outputs
- `app/api/market/top-movers/route.ts`

## Verify
- Stocks: returns 5 gainers + 5 losers from FMP/Finnhub
- Crypto: returns 5 gainers + 5 losers from CoinGecko
- All sources fail → stale data with `stale: true` flag

## Handoff
→ TS.2.3 (Sector taxonomy)
