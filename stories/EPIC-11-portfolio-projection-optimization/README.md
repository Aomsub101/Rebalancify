# EPIC-11 — Portfolio Projection & Optimization (v2.0)

## Context

Rebalancify's rebalancing engine tells users *where they are*. EPIC-11 adds *where they could be* — a mean-variance optimization engine that simulates three portfolio strategies based on historical data.

## Scope

- `asset_historical_data` Supabase caching table with stale-while-revalidate yfinance fetch
- `POST /api/optimize` Python serverless function (scipy.optimize)
- SimulateScenariosButton with min-2-assets and min-3-months constraints
- SimulationResultsTable with three strategy cards and "Apply Weights" wiring
- Dynamic truncation warning when lookback < 3 years

## Stories

| Story | Title | Effort |
|---|---|---|
| STORY-040 | asset_historical_data table + yfinance UPSERT | 1.5d |
| STORY-041 | Python optimization API (/api/optimize) | 2d |
| STORY-042 | SimulateScenariosButton + constraint logic | 1.5d |
| STORY-043 | SimulationResultsTable + Apply Weights wiring | 1.5d |

## Dependencies

- EPIC-09 (AI Research Hub v2.0) must be complete before starting EPIC-11
- Phase 0.2 (all migrations including v2.0 tables) must be complete
- STORY-008 (Target weights editor) must be complete — its inline editors are pre-filled by STORY-043
