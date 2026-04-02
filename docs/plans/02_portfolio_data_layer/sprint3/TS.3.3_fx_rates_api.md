# TS.3.3 — FX Rates API

## Task
Implement GET /api/fx-rates with ExchangeRate-API integration and 60-min TTL cache.

## Target
`app/api/fx-rates/route.ts`, `lib/fxRates.ts`

## Inputs
- `docs/architecture/components/02_portfolio_data_layer/06-fx_rates_usd_toggle.md`
- `docs/architecture/components/05_market_data_pricing/02-fx_rates_service.md`

## Process
1. Create `lib/fxRates.ts`:
   - `parseExchangeRates(data)` — parse ExchangeRate-API v6 response
   - `rateToUsd(currency, rates)` — compute `1 / conversion_rate`
2. Create `app/api/fx-rates/route.ts`:
   - Check `fx_rates` table: if any row has `fetched_at` within 60 min → return cached
   - If stale: fetch `https://api.exchangerate-api.com/v6/latest/USD`
   - Parse `conversion_rates`, compute `rate_to_usd = 1 / rate`
   - Upsert into `fx_rates` table
   - On API failure: return stale cached rates (no error to user)
   - On quota exhaustion (HTTP 429): log `EXCHANGERATE_QUOTA_EXHAUSTED`
3. Response: array of `{ currency, rate_to_usd, fetched_at }`

## Outputs
- `lib/fxRates.ts`
- `app/api/fx-rates/route.ts`

## Verify
- Second call within 60 min → no external API call
- API unavailable → returns stale cached rates
- Rate math: THB rate_to_usd ≈ 0.028 (sanity check)

## Handoff
→ TS.3.4 (USD toggle)
