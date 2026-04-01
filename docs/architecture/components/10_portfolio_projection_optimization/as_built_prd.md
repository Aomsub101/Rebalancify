# Component 10 — Portfolio Projection & Optimization Engine: As-Built PRD

> Reverse-engineered from implementation as of 2026-04-01. All facts derived from verified source files — no speculation.

---

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

### Railway FastAPI Service

Three Python modules:

- `api/index.py` — FastAPI app factory, CORS configuration (locked to localhost:3000 + production Vercel origin), router mounting
- `api/optimize.py` — Optimization endpoint: cache-first price fetch → truncation → annualized μ/Σ → three scipy.optimize strategies → 3-month projection → F11-R14 response
- `api/backfill_debut.py` — Backfill endpoint: yfinance 5yr → earliest date → `assets.market_debut_date` upsert

All routes require `X-API-Key` header validated against `RAILWAY_API_KEY` env var.

### Next.js Proxy Route

`app/api/optimize/route.ts` — thin POST handler that forwards `{ tickers }` to `${RAILWAY_URL}/optimize` with `X-API-Key` header. `RAILWAY_URL` and `RAILWAY_API_KEY` are server-side only; never in the browser bundle.

### Frontend Simulation UI

Five React components in `components/simulation/`:

| Component | Role |
|---|---|
| `SimulateScenariosButton` | Disabled if < 2 assets or any asset < 3 months old; shows loading spinner when in-flight |
| `SimulationResultsTable` | Assembles: Disclaimer → TruncationWarning → 3× StrategyCard |
| `SimulationDisclaimer` | Non-collapsible amber banner (F11-R12) |
| `TruncationWarning` | Amber alert when `lookback_months < 36` |
| `StrategyCard` | One row per strategy: name / weights / return_3m / range / Apply Weights |

### `lib/types/simulation.ts`

TypeScript interfaces matching the F11-R14 response shape:

```typescript
interface SimulationStrategy {
  weights: Record<string, number> // e.g. { AAPL: 0.4, TSLA: 0.6 }
  return_3m: string               // e.g. "2.34%"
  range: string                    // e.g. "2.34% ± 1.20%"
}
interface SimulationStrategies {
  not_to_lose: SimulationStrategy
  expected: SimulationStrategy
  optimistic: SimulationStrategy
}
interface SimulationMetadata {
  is_truncated_below_3_years: boolean
  limiting_ticker: string
  lookback_months: number
}
interface SimulationResult {
  strategies: SimulationStrategies
  metadata: SimulationMetadata
}
```

### `hooks/useSimulationConstraints.ts`

Pure-compute hook (no API calls) that derives button enable/disable state from the holdings array:
- `assetCount < 2` → disabled, reason: "Simulation requires at least 2 assets."
- Any holding with `market_debut_date = NULL` or `< 3 months ago` → disabled, reason: "Simulation requires all assets to have at least 3 months of market price history."
- `useRef` in the parent component tracks `lastSimulatedState` (sorted comma-separated tickers) for F11-R13 deduplication.

### Apply Weights (F11-R11)

"Apply Weights" emits `{ AAPL: 0.4, TSLA: 0.6 }` via `onApply` prop. Parent `SiloDetailView` converts ticker keys to `asset_id` keys and populates local weight-editor state. No API call, no persistence — user must manually save.

---

## 4. Key Implementation Facts

| Fact | Value |
|---|---|
| Optimization runtime | Python 3.12 / scipy.optimize SLSQP |
| Risk-free rate (Max Sharpe) | 0.04 (4% annual) |
| Target Risk volatility cap | 1.5 × Max Sharpe portfolio volatility |
| Price history TTL | 24 hours in Supabase `asset_historical_data` |
| Minimum yfinance lookback | Up to 5 years |
| Weight sum constraint | 1.0 ± 0.001 (scipy `eq` constraint) |
| Weight bounds | 0 ≤ wᵢ ≤ 1 |
| Annualization factor | 252 trading days |
| 3-month scaling | `(3/12)` for returns, `√(3/12)` for volatility |
| Weight rounding | 6 decimal places in response |
| Return/range format | `"X.XX%"` and `"X.XX% ± Y.YY%"` |

---

## 5. Database Tables Written By This Component

### `asset_historical_data` (global cache, no RLS)

| Column | Type | Description |
|---|---|---|
| `ticker` | TEXT PK | Asset ticker symbol |
| `historical_prices` | JSONB | `[{ date: "YYYY-MM-DD", close: number }]` ascending |
| `last_updated` | TIMESTAMPTZ | Cache freshness |

### `assets` (written by Railway backfill)

| Column | Type | Written By |
|---|---|---|
| `market_debut_date` | DATE | Both `POST /optimize` (on cache miss) and `POST /backfill_debut` |
