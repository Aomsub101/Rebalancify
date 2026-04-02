# TS.2.3 — Simulation Results Table

## Task
Build SimulationResultsTable with SimulationDisclaimer, TruncationWarning, and StrategyCard × 3.

## Target
`components/simulation/`

## Inputs
- `docs/architecture/components/10_portfolio_projection_optimization/03-simulation_ui.md`

## Process
1. Create `components/simulation/SimulationResultsTable.tsx`:
   - Assembles: SimulationDisclaimer → TruncationWarning → 3× StrategyCard
   - Shown after successful simulation response
2. Create `components/simulation/SimulationDisclaimer.tsx`:
   - Non-collapsible amber banner
   - Text: "These projections are based on historical data and do not guarantee future results."
   - Always visible during simulation (same pattern as DisclaimerBanner)
3. Create `components/simulation/TruncationWarning.tsx`:
   - Amber alert shown when `metadata.lookback_months < 36`
   - Text: "Limited to X months of data due to [limiting_ticker]. Results may be less reliable."
4. Create `components/simulation/StrategyCard.tsx`:
   - One card per strategy: Not to Lose / Expected / Optimistic
   - Display: strategy name, weight distribution, return_3m, range
   - "Apply Weights" button per card (TS.2.4)

## Outputs
- `components/simulation/SimulationResultsTable.tsx`
- `components/simulation/SimulationDisclaimer.tsx`
- `components/simulation/TruncationWarning.tsx`
- `components/simulation/StrategyCard.tsx`
- `lib/types/simulation.ts` (TypeScript interfaces)

## Verify
- 3 strategy cards render after simulation
- Disclaimer always visible
- TruncationWarning conditional on lookback_months < 36
- Weight distributions sum to ~100%

## Handoff
→ TS.2.4 (Apply Weights)
