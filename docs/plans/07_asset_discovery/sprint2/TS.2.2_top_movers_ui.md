# TS.2.2 — Top Movers UI

## Task
Build TopMoversTabs and TopMoversTable components.

## Target
`components/discover/`

## Inputs
- `docs/architecture/components/07_asset_discovery/01_top_movers_tabs.md`
- `docs/architecture/components/07_asset_discovery/02_top_movers_table.md`

## Process
1. Create `components/discover/TopMoversTabs.tsx`:
   - Two tabs: "US Stocks" and "Crypto"
   - Each tab renders TopMoversTable with gainers and losers
2. Create `components/discover/TopMoversTable.tsx`:
   - Two columns: Gainers (left) and Losers (right)
   - Each row: ticker, name, price, daily_change_pct
   - **Non-colour signals:** Gainers → green bg + TrendingUp icon; Losers → red bg + TrendingDown icon
   - StalenessTag when `stale: true`
   - EmptyState when no data
   - LoadingSkeleton during load

## Outputs
- `components/discover/TopMoversTabs.tsx`
- `components/discover/TopMoversTable.tsx`

## Verify
- Correct icon + color for gainers/losers
- StalenessTag when stale data
- EmptyState when all sources failed

## Handoff
→ TS.2.3 (Peer search UI)
