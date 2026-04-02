# TS.1.3 — Asset Search API

## Task
Implement GET /api/assets/search delegating to Finnhub (stocks/ETFs) and CoinGecko (crypto).

## Target
`app/api/assets/search/route.ts`

## Inputs
- Component 01 outputs (auth middleware)
- `docs/architecture/components/02_portfolio_data_layer/07-asset_search_mapping.md`

## Process
1. Create `app/api/assets/search/route.ts`:
   - Query params: `q` (search term), `type` ('stock' | 'crypto')
   - **Stocks/ETFs:** Call Finnhub `/search?q={term}` with `FINNHUB_API_KEY`
     - Return top 10 results with: ticker, name, type, exchange
   - **Crypto:** Call CoinGecko `/search?query={term}` (no API key needed)
     - Return top 10 results with: ticker (symbol), name, coingecko_id
   - Normalize response shape for both sources
2. Response shape:
   ```json
   {
     "results": [
       { "ticker": "AAPL", "name": "Apple Inc", "type": "stock", "exchange": "NASDAQ", "price_source": "finnhub" }
     ]
   }
   ```
3. Handle rate limits gracefully (429 → return empty with `rate_limited: true`)

## Outputs
- `app/api/assets/search/route.ts`

## Verify
- Search "AAPL" with type=stock → returns Apple
- Search "bitcoin" with type=crypto → returns Bitcoin with coingecko_id
- Rate limit → graceful degradation

## Handoff
→ TS.1.4 (Asset mapping)
