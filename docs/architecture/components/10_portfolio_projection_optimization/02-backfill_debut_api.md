# Sub-Component: Backfill Debut API (Railway FastAPI)

## 1. The Goal

Provide a `POST /backfill_debut` endpoint on the Railway-hosted FastAPI microservice that accepts a single ticker symbol, fetches up to 5 years of yfinance price history, extracts the earliest available trading date, and upserts it into `assets.market_debut_date` in Supabase. This populates the `market_debut_date` field that gates the "Simulate Scenarios" button's 3-month minimum age constraint.

---

## 2. The Problem It Solves

When a user adds a newly listed asset to their silo, its `market_debut_date` in the `assets` table may be NULL (because it was never fetched by any prior component). Without a `market_debut_date`, the `useSimulationConstraints` hook cannot verify the 3-month trading history requirement and must disable the simulation button. The backfill endpoint provides an on-demand mechanism to populate this field without requiring a full simulation run.

---

## 3. The Proposed Solution / Underlying Concept

### Endpoint Contract

**`POST /backfill_debut`** — FastAPI route registered at `/backfill_debut` prefix.

Request:
```json
{ "ticker": "AAPL" }
```

Response:
```json
{ "ticker": "AAPL", "market_debut_date": "1980-12-12" }
```

### Logic (`fetch_and_upsert_debut()`)

1. Call `yf.Ticker(ticker_upper).history(period="5y")`
2. Iterate rows, collect `(date_str, close)` pairs where `close` is not NaN
3. Sort ascending by date
4. First entry's date = `debut_date`
5. If fewer than 2 price points → `BackfillError`
6. Upsert `assets` table: `{ ticker: ticker_upper, market_debut_date: debut_date }` with `ON CONFLICT (ticker) DO UPDATE SET market_debut_date = EXCLUDED.market_debut_date` — **older date wins** because yfinance lookback is always up to 5 years
7. Return `{ ticker, market_debut_date }`

### Authentication

Same `verify_api_key` dependency as the optimizer API — `X-API-Key` header validated against `RAILWAY_API_KEY` env var.

### Error Handling

| Error Condition | HTTP Status | Code |
|---|---|---|
| Empty/blank ticker | 400 | plain `detail` |
| yfinance fetch fails | 422 | `BACKFILL_ERROR` |
| Ticker not found / no history | 422 | `BACKFILL_ERROR` |
| Fewer than 2 price points | 422 | `BACKFILL_ERROR` |
| SUPABASE_URL or SERVICE_ROLE_KEY not set | 500 | plain `detail` |
| Any other exception | 500 | `INTERNAL_ERROR` |

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| `POST /backfill_debut` returns date string | `curl -X POST ${RAILWAY_URL}/backfill_debut -H "X-API-Key: ..." -d '{"ticker":"AAPL"}'` → `{ ticker, market_debut_date }` |
| Unknown ticker → 422 | `{"ticker": "NOTASYMBOL123"}` → 422 `BACKFILL_ERROR` |
| Missing X-API-Key → 401 | Without header → 401 |
| NULL `market_debut_date` in assets after call | Query Supabase assets table for ticker before and after |
| Older date wins on re-backfill | Call with a ticker that already has a `market_debut_date` → confirm older date is preserved |
| No secrets in response body | Response contains only `{ ticker, market_debut_date }` — no API keys |
