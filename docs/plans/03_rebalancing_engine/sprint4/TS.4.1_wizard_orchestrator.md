# TS.4.1 — Wizard Orchestrator

## Task
Build the RebalancePage with 3-step wizard and StepIndicator.

## Target
`app/(dashboard)/silos/[silo_id]/rebalance/page.tsx`

## Inputs
- Sprint 2-3 outputs (calculate + execute routes)
- `docs/architecture/components/03_rebalancing_engine/06-rebalance_wizard_view.md`
- `docs/architecture/04-component-tree.md` §2.6

## Process
1. Create `app/(dashboard)/silos/[silo_id]/rebalance/page.tsx`:
   - State machine: step 1 (config) → step 2 (review) → step 3 (result)
   - `StepIndicator` component: `① Config → ② Review → ③ Result`
   - Step transitions:
     - Config → Calculate button → POST /calculate → advance to Review
     - Review → Execute button → ConfirmDialog → POST /execute → advance to Result
     - Review → Cancel → back to Config
   - Hold session_id and orders in local state between steps
   - `PriceAgeNotice` in Step 1: oldest price_cache.fetched_at across silo holdings
2. Create `components/rebalance/StepIndicator.tsx`
3. Error handling: API failures show ErrorBanner, don't advance step

## Outputs
- `app/(dashboard)/silos/[silo_id]/rebalance/page.tsx`
- `components/rebalance/StepIndicator.tsx`

## Verify
- Step transitions work correctly
- Can go back from Step 2 to Step 1
- Cannot go back from Step 3

## Handoff
→ TS.4.2 (Config panel)
