# TS.4.3 — Order Review Panel (Step 2)

## Task
Build the order review panel with OrdersTable, skip checkboxes, and execution controls.

## Target
`components/rebalance/OrderReviewPanel.tsx`

## Inputs
- TS.2.2 outputs (calculate route returns orders)
- `docs/architecture/components/03_rebalancing_engine/08-order_review_panel.md`

## Process
1. Create `components/rebalance/OrderReviewPanel.tsx`:
   - **SessionSummaryBar:** total buys, total sells, net cash change
   - **ExecutionModeNotice:** Non-dismissible banner for non-Alpaca silos
   - **BalanceErrorBanner:** Shown if `balance_valid = false` (halts at Step 1)
   - **OrdersTable:** One row per order with:
     - TickerCell, OrderTypeBadge (BUY green / SELL red)
     - QuantityCell, EstimatedValueCell
     - WeightArrow (before_pct → after_pct)
     - SkipCheckbox (user can skip individual orders)
   - **CancelButton:** Ghost, left-aligned → returns to Step 1
   - **ExecuteButton:** Primary, right-aligned → opens ConfirmDialog
2. Track `approved_order_ids` (unchecked = approved, checked = skipped)
3. ConfirmDialog shows: order count, platform name, total estimated value

## Outputs
- `components/rebalance/OrderReviewPanel.tsx`
- `components/rebalance/OrdersTable.tsx`
- `components/shared/ExecutionModeNotice.tsx`

## Verify
- Skip checkboxes work (skipped orders excluded from execution)
- BalanceErrorBanner prevents proceeding
- ExecutionModeNotice appears for non-Alpaca silos

## Handoff
→ TS.4.4 (Execution result panel)
