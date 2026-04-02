# TS.1.2 — Optimizer Endpoint

## Task
Implement POST /optimize — cache-first price fetch → truncation → scipy SLSQP → 3 strategies.

## Target
`api/optimize.py`

## Inputs
- `docs/architecture/components/10_portfolio_projection_optimization/01-optimizer_api.md`

## Process
1. Create `api/optimize.py`:
   - Input: `{ tickers: string[] }` (2+ tickers required)
   - **Step 1 — Price fetch:** Check `asset_historical_data` cache (24h TTL). On miss: yfinance 5yr history → upsert cache + `assets.market_debut_date`
   - **Step 2 — Truncation:** Find limiting ticker (shortest history). Truncate all series to same date range. If < 3 months → reject.
   - **Step 3 — Annualized μ/Σ:** Daily returns → annualized mean returns (×252) and covariance matrix (×252)
   - **Step 4 — Three strategies (scipy.optimize SLSQP):**
     - **Not to Lose:** Minimize portfolio volatility (min-variance)
     - **Expected:** Maximize Sharpe ratio (risk-free rate = 4%)
     - **Optimistic:** Target return at 1.5× Max Sharpe return, minimize risk
   - **Step 5 — 3-month projection:** Scale returns by (3/12), volatility by √(3/12)
   - **Step 6 — Response:** Per strategy: weights (6 dp), return_3m ("X.XX%"), range ("X.XX% ± Y.YY%")
2. Constraints: weight sum = 1.0 ± 0.001, each weight 0 ≤ wᵢ ≤ 1
3. Metadata: `is_truncated_below_3_years`, `limiting_ticker`, `lookback_months`

## Outputs
- `api/optimize.py`

## Verify
- 2 tickers → 3 strategies with valid weights summing to ~1.0
- < 2 tickers → 422
- < 3 months history → 422
- Weight bounds respected (0 ≤ w ≤ 1)

## Handoff
→ TS.1.3 (Backfill endpoint)
