# TS.4.4 — Execution Result Panel (Step 3)

## Task
Build the execution result panel showing per-order status and manual instructions.

## Target
`components/rebalance/ExecutionResultPanel.tsx`

## Inputs
- TS.3.1-3.2 outputs (execute route returns results)
- `docs/architecture/components/03_rebalancing_engine/09-execution_result_panel.md`

## Process
1. Create `components/rebalance/ExecutionResultPanel.tsx`:
   - **AlpacaResultSection** (if platform = 'alpaca'):
     - OrderStatusList: per order → executed | skipped | failed
     - Failed orders show error message from Alpaca
   - **ManualOrderInstructions** (if platform ≠ 'alpaca' or any manual orders):
     - CopyAllButton: copies all instructions as plain text → `toast.success('Instructions copied')`
     - ManualOrderRow per order: instruction text + CopyRowButton (icon-only)
   - **BackToSiloButton:** Navigates to `/silos/[silo_id]`
2. Copy functionality uses `navigator.clipboard.writeText()`
3. Sonner toast for copy confirmations

## Outputs
- `components/rebalance/ExecutionResultPanel.tsx`

## Verify
- Alpaca results show correct execution statuses
- Manual instructions display correctly per platform
- Copy buttons work and show toast
- BackToSilo navigates correctly

## Handoff
→ Sprint 5 (History UI + Testing)
