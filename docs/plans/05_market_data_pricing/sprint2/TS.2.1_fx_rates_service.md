# TS.2.1 — FX Rates Service

## Task
Implement FX rates service with ExchangeRate-API integration and 60-min TTL cache.

## Target
`lib/fxRates.ts`, `app/api/fx-rates/route.ts`

## Inputs
- `docs/architecture/components/05_market_data_pricing/02-fx_rates_service.md`

## Process
1. Create `lib/fxRates.ts`:
   - `parseExchangeRates(data)` — parse ExchangeRate-API v6 response
   - `rateToUsd(currency, rates)` — compute `1 / conversion_rate` for each currency
2. Create `app/api/fx-rates/route.ts`:
   - Check `fx_rates` table for `fetched_at` within 60 min → return cached
   - If stale: fetch `https://api.exchangerate-api.com/v6/latest/USD`
   - Invert conversion rates to get `rate_to_usd`
   - Upsert into `fx_rates` table
   - On API failure: return stale cached rates (no error to user)
   - On HTTP 429: log `EXCHANGERATE_QUOTA_EXHAUSTED`, return stale data
3. Response: `{ rates: [{ currency, rate_to_usd, fetched_at }], stale: boolean }`

## Outputs
- `lib/fxRates.ts`
- `app/api/fx-rates/route.ts`

## Verify
- 60-min TTL respected
- API failure → stale rates returned
- Rate inversion math correct (THB rate_to_usd ≈ 0.028)

## Handoff
→ TS.2.2 (Top movers)
