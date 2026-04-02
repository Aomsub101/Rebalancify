# TS.2.4 — Portfolio Drift Summary

## Task
Build PortfolioDriftSummary sidebar showing per-silo drift mini-summary.

## Target
`components/discover/`

## Inputs
- `docs/architecture/components/07_asset_discovery/05_portfolio_drift_summary.md`
- `docs/architecture/components/07_asset_discovery/06_drift_silo_block.md`

## Process
1. Create `components/discover/PortfolioDriftSummary.tsx`:
   - Fetch drift for each silo: `GET /api/silos/:id/drift` for each active silo
   - Render one DriftSiloBlock per silo
2. Create `components/discover/DriftSiloBlock.tsx`:
   - SiloNameHeader (silo name + platform badge)
   - DriftMiniRow per asset: ticker + DriftBadge (green/yellow/red)
   - Compact display: just ticker + badge, no values
3. Gives user context about existing portfolio before exploring new assets

## Outputs
- `components/discover/PortfolioDriftSummary.tsx`
- `components/discover/DriftSiloBlock.tsx`

## Verify
- All active silos shown
- Per-asset drift badges correct
- Compact display (no value clutter)

## Handoff
→ Sprint 3 (Testing)
