# TS.3.1 — Python Unit Tests

## Task
Write Python unit tests for scipy optimization, truncation logic, and response formatting.

## Target
`api/tests/`

## Process
1. `api/tests/test_optimize.py`:
   - 2 tickers → 3 strategies returned with valid weights
   - Weight sum ≈ 1.0 (± 0.001) for each strategy
   - Weight bounds: 0 ≤ wᵢ ≤ 1 for all weights
   - Return format: "X.XX%", range format: "X.XX% ± Y.YY%"
   - < 2 tickers → 422 error
   - < 3 months history → 422 error
2. `api/tests/test_truncation.py`:
   - 3 tickers with different history lengths → truncated to shortest
   - `is_truncated_below_3_years` flag set correctly
   - `limiting_ticker` identifies the shortest-history ticker
   - `lookback_months` computed correctly
3. `api/tests/test_backfill.py`:
   - Known ticker → market_debut_date extracted correctly
   - Unknown ticker → appropriate error
4. `api/tests/test_cache.py`:
   - Cache hit (< 24h) → no yfinance call
   - Cache miss → yfinance called, cache updated

## Outputs
- `api/tests/test_optimize.py`
- `api/tests/test_truncation.py`
- `api/tests/test_backfill.py`
- `api/tests/test_cache.py`

## Verify
- `pytest api/tests/` — all pass

## Handoff
→ TS.3.2 (Frontend tests)
