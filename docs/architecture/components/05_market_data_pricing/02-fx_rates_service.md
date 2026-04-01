# 02 — FX Rates Service

## The Goal

Allow Rebalancify to display holdings and values in currencies other than USD. The FX service fetches live rates from ExchangeRate-API with a 60-minute TTL, caches them in `fx_rates`, and falls back to stale cached rates gracefully when the external API is unavailable.

---

## The Problem It Solves

BITKUB holdings are denominated in THB. InnovestX equity holdings may be in THB. Without FX conversion, the portfolio would show meaningless THB prices alongside USD values. A 60-minute TTL is appropriate for FX rates since exchange rates change slowly compared to stock prices.

---

## Implementation Details

**Library:** `lib/fxRates.ts` (pure parsing helpers)
**Route:** `app/api/fx-rates/route.ts`

### parseExchangeRates(data)

Parses ExchangeRate-API v6 response:
```json
{
  "result": "success",
  "conversion_rates": { "THB": 35.5, "EUR": 0.92, ... }
}
```

Throws `Error("ExchangeRate-API error: <type>")` if `result !== 'success'`. Throws `Error("ExchangeRate-API returned no conversion_rates")` if field missing.

### rateToUsd(currency, rates)

Given `rates = { THB: 35.5 }`, computes `rate_to_usd = 1 / 35.5 = 0.02816901`. Returns as 8dp string to match `NUMERIC(20,8)`. Throws if currency not in rates.

### Route Handler — `GET /api/fx-rates`

1. Check `fx_rates` table for all currencies with `fetched_at > NOW() - INTERVAL '60 minutes'`
2. If all present → return cached rates
3. On stale: fetch `GET https://api.exchangerate-api.com/v6/latest/USD`
4. Parse with `parseExchangeRates()`
5. For each currency, compute `rateToUsd(currency, rates)` and upsert into `fx_rates`
6. On API failure: return stale cached rows with original `fetched_at` (no error thrown)

### Response Shape

```json
{
  "base": "USD",
  "rates": {
    "THB": { "rate_to_usd": "0.02816901", "fetched_at": "2026-04-01T10:00:00.000Z" },
    "EUR": { "rate_to_usd": "1.08695652", "fetched_at": "2026-04-01T10:00:00.000Z" }
  }
}
```

---

## Testing & Verification

| Check | Method |
|---|---|
| 60-min TTL enforced | Unit test: call twice within 60 min → ExchangeRate-API called once |
| API failure → stale cache returned | Manual: block API → fx-rates returns cached data with original `fetched_at` |
| `rate_to_usd` inverted correctly | Unit test: `rateToUsd('THB', {THB: 35.5})` → `"0.02816901"` |
| USD → `rate_to_usd = 1` | Unit test: `rateToUsd('USD', {USD: 1})` → `"1.00000000"` |
| Unknown currency throws | Unit test: `rateToUsd('XYZ', {})` → throws |
| All 8dp string precision | Manual: verify fx_rates table stores NUMERIC(20,8) |
