# Component 10 — Portfolio Projection & Optimization Engine

## 1. The Goal

Give self-directed investors a scenario-simulation engine that runs Markowitz mean-variance portfolio optimization on any silo of 2 or more assets, returning three strategy allocations with 3-month forward projections — so users can understand how different risk/return objectives would translate into weight targets before committing to any rebalance. Every allocation decision remains strictly with the user; no output constitutes financial advice.

---

## 2. The Problem It Solves

Without this component, investors using Rebalancify can see their current drift and set target weights manually, but have no quantitative framework for deciding what those target weights should be. The natural question "should I tilt more toward growth assets or prioritize stability?" requires running covariance math across the asset universe — too complex for mental arithmetic, and computationally inappropriate for a Next.js serverless function running on Vercel (60s timeout, no persistent scipy). A dedicated Python microservice solves both the computational requirement and the cold-start penalty, while a stale-while-revalidate cache prevents yfinance rate-limit hits on repeated simulations.

---

## 3. The Proposed Solution / Underlying Concept

### Architecture Overview

The component spans two deployed environments:

```
Browser
  └── Next.js (Vercel) — app/api/optimize/route.ts (proxy, never exposes Railway key)
        └── Railway — FastAPI microservice
              ├── POST /optimize     → run_optimization()
              └── POST /backfill_debut → fetch_and_upsert_debut()
                    └── yfinance 5yr history
                    └── Supabase asset_historical_data + assets tables
```

**`railway.json`** configures the Railway deployment:
- Builder: Nixpacks with Python 3.12
- Start command: `uvicorn api.index:app --host 0.0.0.0 --port $PORT`
- Num replicas: 1, restart on failure (max 10 retries)

### FastAPI Service (`api/index.py`, `api/optimize.py`, `api/backfill_debut.py`)

**CORS** is locked to `http://localhost:3000` and `https://rebalancify.vercel.app` — no wildcard. Only `POST` methods are allowed. The `X-API-Key` header is validated against the `RAILWAY_API_KEY` environment variable on every request.

**`POST /optimize`** (F11-R14):

1. Validate ≥ 2 ticker strings, deduplicate
2. `fetch_prices()` — cache-first from `asset_historical_data` (Supabase, 24h TTL). On miss: call yfinance, upsert to Supabase, also upsert `market_debut_date` into `assets`
3. `truncate_to_common_length()` — identify shortest series, truncate all to match; derive `lookback_months`
4. `calculate_annualized_metrics()` — daily returns → μ × 252, Σ × 252; ensure positive semi-definiteness
5. Run three scipy.optimize strategies:
   - `min_variance_portfolio()` — SLSQP, min `w'Σw` s.t. Σwᵢ = 1, 0 ≤ wᵢ ≤ 1
   - `max_sharpe_portfolio()` — SLSQP, max `(w'μ - Rf) / √(w'Σw)`, Rf = 0.04
   - `target_risk_portfolio()` — SLSQP, max `w'μ` s.t. `√(w'Σw) ≤ 1.5 × σ_sharpe`
6. `project_3m()` — scale annual return and volatility to 3-month confidence interval
7. Return F11-R14 shape: `{ strategies: { not_to_lose, expected, optimistic }, metadata }`

**`POST /backfill_debut`** — standalone endpoint called when an asset's `market_debut_date` is NULL and the simulation button would be disabled. Fetches yfinance 5yr, extracts earliest date, upserts `assets.market_debut_date`.

### Next.js Proxy Route (`app/api/optimize/route.ts`)

A thin Next.js Route Handler that receives `{ tickers: string[] }` from the browser, forwards to `${RAILWAY_URL}/optimize` with `X-API-Key: RAILWAY_API_KEY` header, and returns the Railway response verbatim. The Railway URL and API key are server-side only (`process.env`); they never appear in the browser bundle.

### Frontend Simulation UI (`components/simulation/`)

| File | Role |
|---|---|
| `SimulateScenariosButton.tsx` | Button placed below holdings table on SiloDetailPage. Disabled if < 2 assets or any asset has `market_debut_date` < 3 months ago. |
| `SimulationResultsTable.tsx` | Assembles full results view: Disclaimer → TruncationWarning → 3× StrategyCard. |
| `SimulationDisclaimer.tsx` | Non-collapsible amber banner with F11-R12 text. Always visible when results are shown. |
| `TruncationWarning.tsx` | Amber alert shown when `lookback_months < 36`. Inline text with `limiting_ticker` and `lookback_months` values. |
| `StrategyCard.tsx` | Single strategy row: name / comma-separated weights / return_3m / range / Apply Weights button. |

### State Deduplication (F11-R13)

`SimulateScenariosButton` uses a `useRef` holding a sorted, comma-separated ticker string. On click, if the current ticker string equals `lastSimulatedState`, no API call is fired — a toast ("Asset composition hasn't changed since last simulation") is shown instead.

### Apply Weights (F11-R11)

"Apply Weights" calls `onApply(weights)` prop with `{ AAPL: 0.4, TSLA: 0.6 }`. The parent `SiloDetailView` converts ticker keys to `asset_id` keys and populates local weight-editor state. No API call, no persistence — the user must manually save via the existing target-weight mechanism.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Railway endpoint returns F11-R14 shape | `curl -X POST ${RAILWAY_URL}/optimize -H "X-API-Key: ..." -d '{"tickers":["AAPL","MSFT"]}'` |
| CORS blocks non-allowed origins | `curl -X POST -H "Origin: https://evil.com" ...` → must return 403 |
| Invalid/missing X-API-Key returns 401 | `curl -X POST ${RAILWAY_URL}/optimize -d '{"tickers":["AAPL"]}'` → 401 |
| Cache hit — no yfinance call | Mock Supabase, call twice within 24h → yfinance not called second time |
| Cache miss — yfinance called | Asset not in `asset_historical_data` → verify yfinance called and Supabase upserted |
| `lookback_months < 36` triggers TruncationWarning | Unit test with mock price series < 36 months → component renders amber alert |
| `lookback_months >= 36` hides TruncationWarning | Unit test with mock price series ≥ 36 months → component returns null |
| Button disabled with < 2 assets | `useSimulationConstraints` with 1 holding → `isDisabled: true` |
| Button disabled when any asset < 3 months old | Holding with `market_debut_date` = today → `isDisabled: true`, reason: "Simulation requires all assets to have at least 3 months of market price history." |
| Weights sum to 1.0 (tol 0.001) | `api/test_optimize.py::TestOptimizationStrategies::test_weights_sum_to_one` |
| Target risk vol ≤ 1.5 × Max Sharpe vol | `api/test_optimize.py::TestOptimizationStrategies::test_optimistic_respects_vol_constraint` |
| Next.js proxy does not expose Railway key | Search browser bundle for `RAILWAY_API_KEY` → zero results |
| `formatNumber()` used for numeric display | `grep /\.toFixed\(/ components/simulation/` → zero results |
| `RAILWAY_URL` and `RAILWAY_API_KEY` set in Vercel env | Vercel dashboard → project settings → environment variables |

---

## 5. Integration

### Railway ↔ Supabase

| Railway Env Var | Supabase Resource | Purpose |
|---|---|---|
| `SUPABASE_URL` | Project URL | Supabase client connection |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | Write access to `asset_historical_data` and `assets` tables |
| `RAILWAY_API_KEY` | — | Shared secret for Next.js → Railway auth |
| `RAILWAY_URL` | Railway deployment URL | Next.js proxy routes here |

### Railway ↔ Next.js (Vercel)

| Next.js Env Var | Railway Resource | Purpose |
|---|---|---|
| `RAILWAY_URL` | Railway deployment URL | `POST app/api/optimize/route.ts` forwards here |
| `RAILWAY_API_KEY` | Railway `RAILWAY_API_KEY` | Sent as `X-API-Key` header on every proxied request |

### Railway ↔ External APIs

| Provider | Purpose |
|---|---|
| yfinance | 5-year daily price history for all tickers |
| No Finnhub/Finnhub/CoinGecko in this component | Price cache is maintained by Components 5 and 2; the optimization engine reads from Supabase only |

### Frontend Integration

| File | Consumed By | How |
|---|---|---|
| `components/simulation/SimulateScenariosButton.tsx` | `SiloDetailPage` | Placed below holdings table; calls `onSimulate` prop |
| `components/simulation/SimulationResultsTable.tsx` | `SiloDetailPage` | Renders below button when simulation result is present |
| `hooks/useSimulationConstraints.ts` | `SimulateScenariosButton` | Returns `isDisabled` and `disableReason` |
| `lib/types/simulation.ts` | All simulation components | Shared TypeScript interfaces |

### `assets` Table Writes (from Railway)

Railway's `fetch_prices()` and `fetch_and_upsert_debut()` both upsert `market_debut_date` into the `assets` table. This write feeds back into Component 2 (Portfolio Data Layer) — specifically the `market_debut_date` field that powers the 3-month minimum age constraint on the simulation button.

### `asset_historical_data` Table

A **global read cache** (no RLS required — written by server-side Railway code only):

| Column | Type | Description |
|---|---|---|
| `ticker` | TEXT PK | Asset ticker symbol |
| `historical_prices` | JSONB | Array of `{ date: "YYYY-MM-DD", close: number }` sorted ascending |
| `last_updated` | TIMESTAMPTZ | Cache freshness marker |
