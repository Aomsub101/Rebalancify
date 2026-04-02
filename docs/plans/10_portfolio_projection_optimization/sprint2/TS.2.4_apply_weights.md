# TS.2.4 — Apply Weights

## Task
Wire "Apply Weights" button to populate the local weight editor on SiloDetailPage.

## Target
`components/simulation/StrategyCard.tsx` (Apply Weights), SiloDetailPage integration

## Inputs
- `docs/architecture/components/10_portfolio_projection_optimization/03-simulation_ui.md`

## Process
1. "Apply Weights" on each StrategyCard:
   - Emits `{ AAPL: 0.4, TSLA: 0.6 }` via `onApply` prop
   - Parent `SiloDetailPage` converts ticker keys to `asset_id` keys
   - Populates local weight-editor state (TargetWeightCell values)
   - **No API call, no persistence** — user must manually save weights
2. Integration with SiloDetailPage:
   - SimulationSection placed below HoldingsTable
   - After Apply: weight cells highlight with new values
   - Dirty guard activates (unsaved changes)
   - User clicks Save to persist via PUT /api/silos/:id/target-weights

## Outputs
- Updated `components/simulation/StrategyCard.tsx` with onApply
- Updated SiloDetailPage with simulation integration

## Verify
- Apply Weights → weight cells populated with strategy values
- No API call on Apply (local state only)
- Dirty guard activates after Apply
- Save persists the applied weights

## Handoff
→ Sprint 3 (Testing)
