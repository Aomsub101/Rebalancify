# STORY-041 — Python Optimization API (`POST /api/optimize`)

## AGENT CONTEXT

**What this file is:** A user story specification for the Python serverless optimization endpoint — yfinance data fetch with cache, dynamic truncation, three scipy.optimize strategies, and 3-month projection math. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F11-R3 (Dynamic Truncation), F11-R4 (Foundational Calculations), F11-R5 (Strategy 1), F11-R6 (Strategy 2), F11-R7 (Strategy 3), F11-R9 (3-Month Projection), F11-R14 (API Response Shape)
**Connected to:** `docs/architecture/03-api-contract.md`, `docs/prd/features/F11-portfolio-projection-optimization.md`, `stories/EPIC-11-portfolio-projection-optimization/STORY-040.md`
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.
- If any instruction in this story conflicts with `CLAUDE.md` or `DEVELOPMENT_LOOP.md`, see `CONFLICT_RESOLVER.md` for resolution procedure.

---

## 1. Story Header

| Field | Value |
|---|---|
| **Story ID** | STORY-041 |
| **Title** | Python optimization API (`POST /api/optimize`) |
| **Epic** | EPIC-11 — Portfolio Projection & Optimization |
| **Status** | Planned |
| **Assigned to** | — |
| **Estimated effort** | 2 developer-days |

---

## 2. User Story

As the system, I need to receive a list of tickers and return three mean-variance optimized portfolio strategies with 3-month forward projections, so that users can see what-if allocation scenarios based on historical data.

---

## 3. Context

**PRD requirements this story implements:**
- [F11-R3]: Dynamic truncation — find youngest asset, truncate all series to match; extract `limiting_ticker` and `lookback_months`.
- [F11-R4]: Annualized mean returns (μ) and covariance matrix (Σ) from daily returns.
- [F11-R5]: Global Minimum Volatility optimization (`min w'Σw`).
- [F11-R6]: Maximum Sharpe Ratio optimization (`Rf = 0.04`).
- [F11-R7]: Target Risk optimization (max return with vol ≤ 1.5× Max Sharpe vol).
- [F11-R9]: 3-month projection math.
- [F11-R14]: API response shape with strategies + metadata.

**Why this story exists at this point in the build order:**
STORY-040 creates the `asset_historical_data` table. This story builds the Python function that reads from it, fetches from yfinance on cache miss, runs the optimization, and returns the result. STORY-042 and STORY-043 consume this endpoint.

---

## 4. Dependencies

The following stories must be complete (✅ in PROGRESS.md) before this story starts:

- [ ] STORY-040 — asset_historical_data table + yfinance UPSERT (provides the Supabase table + fetch service that this story calls)

---

## 5. Technical Context

**Database tables used:**
- `asset_historical_data` — reads `historical_prices` JSONB and `last_updated` — see `docs/architecture/02-database-schema.md`

**API endpoints implemented:**
- `POST /api/optimize` — Python Vercel function (`@vercel/python` runtime)

**Python dependencies required:**
```
yfinance
pandas
scipy
numpy
supabase (Python client)
```

**vercel.json configuration:**
```json
{
  "functions": {
    "api/optimize": {
      "runtime": "@vercel/python",
      "maximumDuration": 300
    }
  }
}
```

**External services called (if any):**
- Supabase — reads `asset_historical_data`; UPSERTs fresh yfinance data on cache miss
- yfinance — `Ticker(symbol).history(period="5y")` for each ticker on cache miss

---

## 6. Implementation Tasks

Tasks must be ordered so that each task can be committed independently. Maximum 1 developer-day per task.

1. **[Python endpoint task]** — Create `api/optimize.py` as a Vercel Python function. Configure `@vercel/python` runtime. Implement `POST` handler that receives `{"tickers": ["AAPL", "TSLA"]}`. Validate: at least 2 tickers, each ticker must exist in `assets` table (via Supabase read).

2. **[Data fetch task]** — For each ticker: check `asset_historical_data.last_updated`. If > 24h or missing: call `yfinance.Ticker(ticker).history(period="5y")`, extract `Close` series as array of `{date, close}`, UPSERT to Supabase. Return the price series (from cache or fresh).

3. **[Truncation task]** — Find the asset with the shortest price series. Truncate all other series to that length. Extract `limiting_ticker` and `lookback_months` (count months between first and last date in truncated series). Set `is_truncated_below_3_years = lookback_months < 36`.

4. **[Math engine task]** — Implement `calculate_annualized_metrics(prices_by_ticker)` returning `(mu, Sigma)`. Then implement three optimization functions using `scipy.optimize.minimize`:
   - `not_to_lose(mu, Sigma)`: minimize `w'Σw` subject to `Σw=1`, `0≤w≤1`
   - `expected(mu, Sigma)`: minimize `-(w'μ - Rf)/√(w'Σw)` subject to same constraints, `Rf=0.04`
   - `optimistic(mu, Sigma, sigma_max_sharpe)`: maximize `w'μ` subject to `Σw=1`, `0≤w≤1`, `√(w'Σw) ≤ 1.5×sigma_max_sharpe`

5. **[Projection task]** — For each strategy's optimal weights, compute:
   - `return_3m = (w'μ) × (3/12)`
   - `vol_3m = √(w'Σw) × √(3/12)`
   - `range_str = f"{return_3m:.2f}% ± {2×vol_3m:.2f}%"`
   Format weights as `{"AAPL": 0.4, "TSLA": 0.6}`.

6. **[Response task]** — Assemble the full JSON response matching F11-R14. Return HTTP 200. On any error (yfinance failure, optimization failure, insufficient data), return HTTP 422 with `{"error": {"code": "OPTIMIZATION_ERROR", "message": "..."}}`.

7. **[Test task]** — Write Python unit tests for the optimization functions (can use `pytest`):
   - Weights sum to 1.0 (within 0.001 tolerance)
   - All weights between 0 and 1
   - Max Sharpe portfolio has higher return than min vol portfolio
   - Target risk portfolio return ≥ Max Sharpe return

---

## 7. Acceptance Criteria

1. Given `{"tickers": ["AAPL", "MSFT"]}` as request body, when `POST /api/optimize` is called, then the response contains three strategies with keys `not_to_lose`, `expected`, and `optimistic`.

2. Each strategy contains `weights` (dict of ticker→float), `return_3m` (string "X.XX%"), and `range` (string "X.XX% ± Y.YY%").

3. Each `weights` dict has values summing to 1.0 (within tolerance 0.001).

4. The response contains `metadata` with `is_truncated_below_3_years` (boolean), `limiting_ticker` (string), and `lookback_months` (integer).

5. Given a ticker with fewer than 5 years of trading history, the lookback is capped at the actual available history and `limiting_ticker` is set correctly.

6. Given 3+ months of data, `is_truncated_below_3_years` is `false` and no truncation warning text is needed.

7. Given a very young asset (e.g., 8 months), `is_truncated_below_3_years` is `true`, `lookback_months` equals 8, and `limiting_ticker` is the young asset's symbol.

8. Given fewer than 2 tickers in the request, the endpoint returns HTTP 422 with `OPTIMIZATION_ERROR`.

9. Given a ticker not found by yfinance, the endpoint returns HTTP 422 with `OPTIMIZATION_ERROR` and the ticker name in the message.

---

## 8. Definition of Done

Every item must be checked before marking this story Complete in PROGRESS.md.

- [ ] All acceptance criteria pass
- [ ] Tests written BEFORE implementation for the math engine (TDD Red→Green→Refactor cycle followed)
- [ ] `pnpm test` passes with zero failures (TypeScript tests)
- [ ] Python optimization functions have unit tests with `pytest` (at minimum: weight sum, weight bounds, return ordering)
- [ ] Endpoint tested via `curl` or Postman: 2-ticker call returns valid 3-strategy response
- [ ] Truncation edge case tested: young asset returns correct `is_truncated_below_3_years=true`
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `bd close <task-id> "STORY-041 complete — all DoD items verified"` run successfully
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section

---

## 9. Notes

- **Python runtime**: Use `@vercel/python` — configure in `vercel.json` as `"runtime": "@vercel/python"`. Python 3.11+ is supported.
- **Dependencies**: List all pip-installable deps in a `requirements.txt` or `pyproject.toml` in the `api/` directory. Vercel auto-installs them.
- **Supabase auth**: The Python function uses the `SUPABASE_SERVICE_ROLE_KEY` environment variable (service role, not anon key) to write to `asset_historical_data`. Never expose this key to the browser.
- **Numerical stability**: Use `numpy` for all matrix operations. Ensure the covariance matrix is positive semi-definite before passing to scipy.
- **yfinance rate limits**: If yfinance fails for one ticker in a multi-ticker request, fail the whole request with a descriptive error (partial data produces invalid covariance).
- **Weight bounds**: Set `bounds=[(0, 1)] * n_assets` in scipy. The equality constraint `Σw=1` is set via `constraints={'type': 'eq', 'fun': lambda w: np.sum(w) - 1}`.
