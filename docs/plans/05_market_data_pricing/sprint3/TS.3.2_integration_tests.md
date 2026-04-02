# TS.3.2 — Integration Tests

## Task
Write integration tests for cache TTL behavior and API failure fallback.

## Target
`tests/integration/`

## Process
1. `tests/integration/price-cache-ttl.test.ts`:
   - First fetch → external API called, cache populated
   - Second fetch within 15 min → cache hit, no external call
   - After 15 min → external API called again, cache refreshed
2. `tests/integration/fx-rates-ttl.test.ts`:
   - First fetch → ExchangeRate-API called
   - Within 60 min → cached rates returned
   - After 60 min → fresh fetch
   - API failure → stale rates returned with original fetched_at
3. `tests/integration/top-movers-fallback.test.ts`:
   - FMP available → FMP data returned
   - FMP fails, Finnhub available → Finnhub data returned
   - Both fail → stale cache with `stale: true`

## Outputs
- `tests/integration/price-cache-ttl.test.ts`
- `tests/integration/fx-rates-ttl.test.ts`
- `tests/integration/top-movers-fallback.test.ts`

## Verify
- All integration tests pass
