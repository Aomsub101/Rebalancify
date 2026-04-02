# TS.2.2 — Simulate Scenarios Button

## Task
Build SimulateScenariosButton with constraint logic and deduplication.

## Target
`components/simulation/SimulateScenariosButton.tsx`, `hooks/useSimulationConstraints.ts`

## Inputs
- `docs/architecture/components/10_portfolio_projection_optimization/03-simulation_ui.md`
- `docs/architecture/components/10_portfolio_projection_optimization/04-simulation_constraints_hook.md`

## Process
1. Create `hooks/useSimulationConstraints.ts`:
   - Pure-compute hook (no API calls)
   - Derives button enable/disable state from holdings array:
     - `assetCount < 2` → disabled, reason: "Simulation requires at least 2 assets."
     - Any holding with `market_debut_date = NULL` or `< 3 months ago` → disabled, reason: "All assets need at least 3 months of market price history."
   - Returns: `{ enabled: boolean, reason?: string }`
2. Create `components/simulation/SimulateScenariosButton.tsx`:
   - Disabled state with tooltip showing reason
   - Loading spinner when simulation in-flight
   - `useRef` in parent tracks `lastSimulatedState` (sorted tickers) for deduplication
   - Clicking triggers POST /api/optimize with current silo tickers
3. Placed on SiloDetailPage below HoldingsTable

## Outputs
- `hooks/useSimulationConstraints.ts`
- `components/simulation/SimulateScenariosButton.tsx`

## Verify
- < 2 assets → button disabled with correct reason
- Asset < 3 months old → button disabled
- Same tickers → deduplication prevents repeat call
- Loading spinner during optimization

## Handoff
→ TS.2.3 (Simulation results)
