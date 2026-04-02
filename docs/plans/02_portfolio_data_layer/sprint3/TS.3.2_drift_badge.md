# TS.3.2 — DriftBadge Component

## Task
Create DriftBadge (green/yellow/red with icon + drift_pct) and DriftCell for HoldingsTable.

## Target
`components/shared/DriftBadge.tsx`

## Inputs
- TS.3.1 outputs (drift calculation)
- `docs/architecture/04-component-tree.md` (Shared Components)

## Process
1. Create `components/shared/DriftBadge.tsx`:
   - Props: `{ state: 'green' | 'yellow' | 'red', drift_pct: number }`
   - Green: `Circle` icon (lucide), green text/bg
   - Yellow: `Triangle` icon, amber text/bg
   - Red: `AlertCircle` icon, red text/bg
   - Display: formatted drift_pct (e.g., "+2.3%" or "-1.5%")
2. Integrate DriftBadge into HoldingsTable as `DriftCell`
3. Also used by: DriftMiniRow (Discover page), GlobalDriftBanner (Overview)

## Outputs
- `components/shared/DriftBadge.tsx`

## Verify
- Correct icon + color for each state
- Drift percentage formatted properly with sign

## Handoff
→ TS.3.3 (FX rates)
