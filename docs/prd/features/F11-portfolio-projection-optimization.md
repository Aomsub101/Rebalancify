# docs/prd/features/F11-portfolio-projection-optimization.md — Feature 11: Portfolio Projection & Optimization (v2.0)

## AGENT CONTEXT

**What this file is:** Requirements for the portfolio simulation and mean-variance optimization feature (v2.0 only).
**Derived from:** `docs/Portfolio_Projection_&_Optimization.md` specification Phase 1–5
**Connected to:** `docs/architecture/02-database-schema.md` (asset_historical_data), `docs/architecture/03-api-contract.md` (POST /api/optimize), `stories/EPIC-11-portfolio-projection-optimization/`
**Critical rules for agents using this file:**
- This entire feature is v2.0. Do not implement any part in v1.0.
- All external API calls (yfinance) must be proxied through the Python serverless function. Keys never reach the browser.
- The simulation is educational only — no output constitutes financial advice. Disclaimer must always be visible.
- Minimum 2 assets and minimum 3 months trading history per asset are hard constraints that disable the button.

---

## Feature Purpose

A scenario-simulation engine that runs mean-variance portfolio optimization (Markowitz framework) on a silo of 2+ assets, returning three strategy allocations with 3-month forward projections. Helps users understand how different risk/return objectives would translate into weight targets — leaving every allocation decision in the user's hands.

---

## Requirements

### F11-R1 — Simulate Scenarios Button

The "Simulate Scenarios" button appears inside a silo on the SiloDetailPage, below the holdings table.

**Button label:** "Simulate Scenarios"

**Constraint 1 (Minimum Assets):** Button is completely disabled if the silo contains fewer than 2 assets. Optimization requires at least 2 assets to calculate covariance.

**Constraint 2 (Minimum Age):** If any asset in the silo has been publicly traded for less than 3 months (calculated from `assets.created_at`), the button is disabled and a tooltip explains: *"Simulation requires all assets to have at least 3 months of trading history."*

**Tooltip:** Rendered via `title` attribute or a accessible tooltip component. Not a blocking modal.

---

### F11-R2 — Stale-While-Revalidate Cache Architecture

Price history is fetched from `yfinance` and cached in Supabase to avoid rate limits.

**Supabase table:** `asset_historical_data`
- `ticker TEXT PRIMARY KEY`
- `historical_prices JSONB` — array of `{ date: "YYYY-MM-DD", close: number }`
- `last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()`

**Fetch logic (upsert):**
1. Check Supabase for the ticker.
2. **Cache hit:** If `last_updated` < 24 hours old → return cached data instantly.
3. **Cache miss or stale:** Fetch up to 5 years of daily closing prices via `yfinance` (or max available if the asset is younger than 5 years). UPSERT into Supabase. Return fresh data.

**No RLS required:** This table is a global read cache written by server-side code only. No user-specific data.

---

### F11-R3 — Dynamic Truncation

The optimization engine identifies the asset with the shortest time-series data and truncates all other asset series to match. This ensures covariance matrix integrity.

**Metadata extraction:** When truncating, calculate:
- `limiting_ticker`: The ticker symbol of the asset that caused the truncation.
- `lookback_months`: The length of the truncated timeframe in months.

**Truncation warning:** If `lookback_months < 36`, the UI must display a prominent warning (see F11-R8).

---

### F11-R4 — Foundational Calculations

For each asset, calculate from the truncated price series:

**Daily percentage returns:** `(price[t] - price[t-1]) / price[t-1]`

**Annualized mean return vector (μ):** Average daily return × 252

**Annualized covariance matrix (Σ):** Covariance of daily returns × 252

---

### F11-R5 — Optimization Strategy 1: Not to Lose (Global Minimum Volatility)

**Objective:** Minimize portfolio variance: `min w'Σw`

**Constraint:** `Σw_i = 1` and `0 ≤ w_i ≤ 1`

**Output:** The minimum-variance allocation (safest mathematical combination).

---

### F11-R6 — Optimization Strategy 2: Expected (Maximum Sharpe Ratio)

**Objective:** Maximize the Sharpe Ratio: `max (w'μ - R_f) / √(w'Σw)`

**Risk-free rate (Rf):** `0.04` (4% annual)

**Constraint:** `Σw_i = 1` and `0 ≤ w_i ≤ 1`

**Output:** The optimal risk-adjusted portfolio.

---

### F11-R7 — Optimization Strategy 3: Optimistic (Target Risk)

**Objective:** Maximize expected return: `max w'μ`

**Constraint:** `Σw_i = 1`, `0 ≤ w_i ≤ 1`, and `√(w'Σw) ≤ 1.5 × σ_max_sharpe`

Portfolio volatility must not exceed 1.5× the volatility of the Maximum Sharpe portfolio.

**Output:** An aggressive, growth-focused allocation that remains diversified.

---

### F11-R8 — Truncation Warning Banner

If `lookback_months < 36` (3 years), a warning box appears directly above or below the Results Table.

**Format:**
> ⚠️ *Note: Because **[limiting_ticker]** only has **[X]** months of trading history, this portfolio projection is limited to a **[X]**-month lookback period. Results may be highly volatile.*

**Implementation:** Read `metadata.is_truncated_below_3_years` from the API response. If `true`, inject `limiting_ticker` and `lookback_months` into the warning text.

---

### F11-R9 — 3-Month Projection Math

For each optimized strategy, compute:

- **3-Month Expected Return:** `(w'μ) × (3/12)`
- **3-Month Volatility:** `√(w'Σw) × √(3/12)`
- **UI Range String:** `[Return]% ± [2 × Volatility]%` (represents the 95% confidence interval)

**Return format:** `"X.XX%"` (two decimal places)
**Range format:** `"X.XX% ± Y.YY%"`

---

### F11-R10 — Results Table

Displays three rows (one per strategy). Columns:

| Column | Content |
|---|---|
| Strategy Name | "Not to Lose" / "Expected" / "Optimistic" |
| Suggested Weights | e.g., AAPL: 40%, TSLA: 60% (formatted as comma-separated ticker: weight%) |
| Expected 3-Month Return | `return_3m` string |
| Action | "Apply Weights" button |

---

### F11-R11 — Apply Weights

Clicking "Apply Weights" on a strategy row pre-fills the silo's target weight input fields with that strategy's suggested weights.

**Implementation:** Sets local React state of the existing weight editor (from STORY-008) — does NOT call any new API and does NOT auto-save.

**After applying:** The simulation results table remains visible. User must manually save via the existing weight save mechanism.

---

### F11-R12 — Financial Disclaimer

Prominently displayed above the results table — always visible, never collapsible:

> *"Simulation results are based on historical data and do not guarantee future performance. This tool is for educational purposes and does not constitute financial advice."*

This is separate from the page footer disclaimer (CLAUDE.md Rule 14) which applies to all pages.

---

### F11-R13 — Frontend State Deduplication

To prevent redundant API calls and wasted compute:

1. Store a `useRef` with a sorted, comma-separated string of the currently simulated tickers (e.g., `"AAPL,TSLA"`).
2. On button click, generate the current ticker string.
3. **If `currentState === lastSimulatedState`:** Do nothing. Fire toast: *"Asset composition hasn't changed since last simulation."*
4. **If different:** Proceed with API call, update `lastSimulatedState`, render results.

---

### F11-R14 — API Response Shape

The Python endpoint returns:

```json
{
  "strategies": {
    "not_to_lose": {
      "weights": { "AAPL": 0.4, "TSLA": 0.6 },
      "return_3m": "2.34%",
      "range": "2.34% ± 1.20%"
    },
    "expected": {
      "weights": { "AAPL": 0.55, "TSLA": 0.45 },
      "return_3m": "3.10%",
      "range": "3.10% ± 1.45%"
    },
    "optimistic": {
      "weights": { "AAPL": 0.70, "TSLA": 0.30 },
      "return_3m": "4.20%",
      "range": "4.20% ± 2.10%"
    }
  },
  "metadata": {
    "is_truncated_below_3_years": true,
    "limiting_ticker": "OKLO",
    "lookback_months": 8
  }
}
```

**Weights constraint:** Each `strategies[*].weights` object must have values that sum to `1.0` (within floating-point tolerance of 0.001).

**API endpoint:** `POST /api/optimize`
