# 04 — fx_rates Table

## The Goal

Store live FX conversion rates so the application can convert THB (and other non-USD currencies) to USD for consolidated portfolio display. Each row represents one currency's rate relative to USD, with a 60-minute TTL enforced by the API route.

---

## The Problem It Solves

BITKUB and some InnovestX positions are denominated in THB. Without FX conversion, a portfolio containing both USD and THB assets would show meaningless mixed values. ExchangeRate-API provides comprehensive global coverage with a generous free tier, and a 60-minute TTL is appropriate since FX rates are slow-moving relative to stock prices.

---

## Schema

```sql
CREATE TABLE fx_rates (
  currency    CHAR(3) PRIMARY KEY,
  rate_to_usd NUMERIC(20,8) NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

| Column | Type | Meaning |
|---|---|---|
| `currency` | CHAR(3) PK | ISO 4217 code, e.g. `'THB'`, `'EUR'` |
| `rate_to_usd` | NUMERIC(20,8) | 1 unit of `currency` = this many USD |
| `fetched_at` | timestamptz | Used for 60-min TTL check in the API route |

### RLS Policy

```sql
ALTER TABLE fx_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY fx_rates_read ON fx_rates FOR SELECT USING (TRUE);
```

All authenticated users can read `fx_rates`. Writes are service-role only.

---

## Usage in Drift Calculation

The drift calculation in Component 2 reads `fx_rates` to convert non-USD holdings to USD:

```
usd_value = parseFloat(holding.quantity) * parseFloat(holding.price) * rateToUsd(currency, fxRates)
```

---

## Testing & Verification

| Check | Method |
|---|---|
| `rate_to_usd` for THB ≈ 0.028 (1 THB ≈ 0.028 USD) | SQL: `SELECT rate_to_usd FROM fx_rates WHERE currency = 'THB'` → verify reasonable value |
| USD → `rate_to_usd = 1` | The API route does not fetch USD (base is USD) |
| 60-min TTL enforced by route | Manual: call fx-rates twice in 30 min → API called once |
| All authenticated users can read | RLS test: two users → both can SELECT fx_rates |
| Writes require service role | RLS test: anon key → INSERT blocked |
