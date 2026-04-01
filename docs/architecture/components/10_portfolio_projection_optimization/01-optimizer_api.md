# Sub-Component: Optimizer API (Railway FastAPI)

## 1. The Goal

Provide a `POST /optimize` endpoint on the Railway-hosted FastAPI microservice that accepts a list of ticker symbols, fetches their price histories (Supabase cache or yfinance), runs full Markowitz mean-variance optimization across three strategies, and returns the three suggested weight allocations with 3-month forward projections and truncation metadata — matching the F11-R14 response shape exactly.

---

## 2. The Problem It Solves

The Next.js Vercel environment cannot run scipy.optimize reliably (no persistent process, cold-start penalty, 60s wall-clock limit). Running 5 years of daily price data through numpy covariance and SLSQP optimization requires a long-running Python process with numpy and scipy available. Separately, yfinance calls must be rate-limited and cached — calling yfinance on every simulation request would hit rate limits immediately. This sub-component solves both the computational hosting problem and the price-history caching problem.

---

## 3. The Proposed Solution / Underlying Concept

### Endpoint Contract

**`POST /optimize`** — FastAPI route registered at `/optimize` prefix.

Request:
```json
{ "tickers": ["AAPL", "MSFT"] }
```

Response (F11-R14):
```json
{
  "strategies": {
    "not_to_lose": { "weights": { "AAPL": 0.4, "MSFT": 0.6 }, "return_3m": "2.34%", "range": "2.34% ± 1.20%" },
    "expected":     { "weights": { "AAPL": 0.55, "MSFT": 0.45 }, "return_3m": "3.10%", "range": "3.10% ± 1.45%" },
    "optimistic":   { "weights": { "AAPL": 0.70, "MSFT": 0.30 }, "return_3m": "4.20%", "range": "4.20% ± 2.10%" }
  },
  "metadata": {
    "is_truncated_below_3_years": true,
    "limiting_ticker": "MSFT",
    "lookback_months": 8
  }
}
```

All weights sum to 1.0 ± 0.001.

### Price Fetching Pipeline (`fetch_prices()`)

```
For each ticker:
  1. Query asset_historical_data.cache_fresh (< 24h old)?
       → YES: use cached data, skip yfinance
       → NO:  call yfinance 5yr history
  2. yfinance returns {date, close}[] sorted ascending
  3. Upsert {ticker, historical_prices, last_updated} to asset_historical_data
  4. Also upsert {ticker, market_debut_date: first_date} to assets table
```

If yfinance returns fewer than 2 price points → `OptimizationError` with ticker.

### Dynamic Truncation (`truncate_to_common_length()`)

Identifies the ticker with the shortest price series. Truncates all series to that length, preserving chronological alignment. Returns `(truncated_prices, limiting_ticker, lookback_months)`.

`lookback_months` is derived from the date difference between first and last entry in the truncated series, divided by 30.44 (average days per month).

If `lookback_months < 36` → `metadata.is_truncated_below_3_years = true`.

### Annualized Metrics (`calculate_annualized_metrics()`)

1. Build daily returns matrix: `daily_rets = (close[t] - close[t-1]) / close[t-1]`
2. Annualize: `μ = mean(daily_rets) × 252`, `Σ = cov(daily_rets) × 252`
3. PSD enforcement: if `Σ` has negative eigenvalues, add `(abs(min_eigenvalue) + 1e-8) × I`

### Three Optimization Strategies

| Strategy | Objective | Constraints |
|---|---|---|
| `not_to_lose` (min variance) | `min w'Σw` | `Σwᵢ = 1`, `0 ≤ wᵢ ≤ 1` |
| `expected` (max Sharpe) | `max (w'μ - 0.04) / √(w'Σw)` | same |
| `optimistic` (target risk) | `max w'μ` | `Σwᵢ = 1`, `0 ≤ wᵢ ≤ 1`, `√(w'Σw) ≤ 1.5 × σ_sharpe` |

All three use `scipy.optimize.minimize` with method `SLSQP`. The Target Risk strategy's volatility constraint is implemented as an `ineq` constraint on the SLSQP problem.

### 3-Month Projection (`project_3m()`)

```
return_3m = (w'μ) × (3/12)
vol_3m    = √(w'Σw) × √(3/12)
return_3m_str = f"{return_3m * 100:.2f}%"
range_str     = f"{return_3m * 100:.2f}% ± {2 * vol_3m * 100:.2f}%"
```

The ± range represents a 95% confidence interval (2 standard deviations).

### Authentication

Every request requires `X-API-Key` header. `verify_api_key()` dependency reads `RAILWAY_API_KEY` env var and compares. Returns 401 if missing or mismatched, 500 if env var not set.

### Error Handling

| Error Condition | HTTP Status | Code |
|---|---|---|
| `< 2` tickers | 422 | `OPTIMIZATION_ERROR` |
| Ticker not found by yfinance | 422 | `OPTIMIZATION_ERROR` |
| Insufficient price data | 422 | `OPTIMIZATION_ERROR` |
| Scipy optimization failure | 422 | `OPTIMIZATION_ERROR` |
| yfinance fetch exception | 422 | `OPTIMIZATION_ERROR` |
| Server-side config missing | 500 | plain `detail` |
| Any other exception | 500 | `INTERNAL_ERROR` |

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| `POST /optimize` returns F11-R14 shape | `curl -X POST ${RAILWAY_URL}/optimize -H "X-API-Key: ..." -d '{"tickers":["AAPL","MSFT"]}'` |
| CORS blocks non-allowed origins | `curl -X POST -H "Origin: evil.com" ...` → 403 |
| Missing X-API-Key → 401 | `curl -X POST ${RAILWAY_URL}/optimize -d '{"tickers":["AAPL"]}'` → 401 |
| 1 ticker → 422 | `{"tickers": ["AAPL"]}` → 422 `OPTIMIZATION_ERROR` |
| All weights sum to 1.0 ± 0.001 | Run multiple tickers, sum each `strategies.*.weights` values |
| Target Risk vol ≤ 1.5 × Max Sharpe vol | Check `√(w_target_risk'Σw_target_risk) ≤ 1.5 × σ_sharpe` |
| Cache hit — no yfinance call | Mock Supabase fresh row → yfinance not called |
| Cache miss → yfinance called → Supabase upserted | Check for yfinance call and two Supabase upserts (asset_historical_data + assets) |
| `lookback_months < 36` flag | Use a ticker with short history → `is_truncated_below_3_years: true` |
| `api/test_optimize.py` passes | `pytest api/test_optimize.py -v` → all green |
| No secrets logged | `grep -r "RAILWAY_API_KEY" app/` → only in server-side route, never in browser bundle |
