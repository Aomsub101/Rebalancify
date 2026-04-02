# TS.1.3 — Backfill Debut Endpoint

## Task
Implement POST /backfill_debut — fetch yfinance 5yr history → update market_debut_date.

## Target
`api/backfill_debut.py`

## Inputs
- `docs/architecture/components/10_portfolio_projection_optimization/02-backfill_debut_api.md`

## Process
1. Create `api/backfill_debut.py`:
   - Input: `{ tickers: string[] }`
   - For each ticker:
     - Fetch 5yr history from yfinance
     - Extract earliest date in history → `market_debut_date`
     - Upsert `assets.market_debut_date` in Supabase
   - Return: `{ results: [{ ticker, market_debut_date, history_months }] }`
2. This data is used by `useSimulationConstraints` hook to determine if assets have sufficient history
3. Also called by POST /optimize on cache miss (dual write path)

## Outputs
- `api/backfill_debut.py`

## Verify
- Ticker with 5yr history → market_debut_date = earliest date
- New ticker not in yfinance → error with ticker name
- assets.market_debut_date updated correctly

## Handoff
→ TS.1.4 (Historical data table)
