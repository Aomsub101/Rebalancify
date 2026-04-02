# TS.3.1 — Unit Tests

## Task
Write unit tests for TTL logic, FX rate inversion, and fallback chains.

## Target
`tests/unit/`

## Process
1. `tests/unit/price-service.test.ts`:
   - Cache hit (is_fresh = true) → return cached, no external call
   - Cache miss → correct external API called based on source
   - Source routing: finnhub, coingecko, alpaca→finnhub, bitkub→coingecko
2. `tests/unit/fx-rates.test.ts`:
   - Rate inversion: `1 / conversion_rate` = `rate_to_usd`
   - 60-min TTL: stale detection correct
   - Parse ExchangeRate-API v6 response format
3. `tests/unit/top-movers.test.ts`:
   - Stocks: FMP → Finnhub → stale cache fallback chain
   - Crypto: CoinGecko fallback to stale
   - Response shape validation (5 gainers + 5 losers)
4. `tests/unit/sector-taxonomy.test.ts`:
   - All sectors have >= 5 tickers
   - Lookup returns correct sector peers
   - Total ticker count >= 110

## Outputs
- `tests/unit/price-service.test.ts`
- `tests/unit/fx-rates.test.ts`
- `tests/unit/top-movers.test.ts`
- `tests/unit/sector-taxonomy.test.ts`

## Verify
- `pnpm test` — all pass
