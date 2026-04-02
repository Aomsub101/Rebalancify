# TS.3.1 — Drift Calculation

## Task
Implement GET /api/silos/:id/drift with three-state classification (green/yellow/red).

## Target
`app/api/silos/[id]/drift/route.ts`, `lib/driftCalculation.ts`

## Inputs
- Sprint 2 outputs (holdings + weights + prices)
- `docs/architecture/components/02_portfolio_data_layer/03-drift_calculation.md`

## Process
1. Create `lib/driftCalculation.ts` — pure function:
   - Input: holdings with current prices, target weights, silo drift_threshold
   - For each asset: `drift_pct = current_weight_pct - target_weight_pct`
   - Three-state classification:
     - **Green:** `ABS(drift_pct) <= drift_threshold`
     - **Yellow:** `threshold < ABS(drift_pct) <= threshold + 2`
     - **Red:** `ABS(drift_pct) > threshold + 2`
   - Drift is computed live on every request — no historical storage
2. Create `app/api/silos/[id]/drift/route.ts`:
   - Fetch holdings + weights + prices for the silo
   - Call drift calculation function
   - Return per-asset drift state + silo-level summary (any_breached, breach_count)

## Outputs
- `lib/driftCalculation.ts`
- `app/api/silos/[id]/drift/route.ts`

## Verify
- Unit test: all three states trigger at correct boundaries
- `grep drift_history` → zero results (no historical storage)
- API returns correct per-asset states

## Handoff
→ TS.3.2 (DriftBadge component)
