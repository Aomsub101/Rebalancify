# TS.4.2 — Config Panel (Step 1)

## Task
Build the rebalance configuration panel with mode selector, cash toggle, and warnings.

## Target
`components/rebalance/ConfigPanel.tsx`

## Inputs
- `docs/architecture/components/03_rebalancing_engine/07-config_panel.md`

## Process
1. Create `components/rebalance/ConfigPanel.tsx`:
   - **PriceAgeNotice:** "Prices last updated X minutes ago" — amber if any > 10 min
   - **ModeSelector:** Radio cards (NOT dropdown) for partial | full
     - Partial: "Sell overweight assets, use proceeds to buy underweight"
     - Full: "Rebalance all positions to exact target weights"
   - **FullRebalanceWarning:** Shown when mode = 'full' — explains potential tax implications
   - **CashToggle:** "Include additional cash in rebalancing"
   - **CashAmountInput:** Shown only when CashToggle is on — numeric input
   - **WeightsSumWarning:** Conditional — shown if target weights don't sum to 100%
   - **CalculateButton:** Primary button → triggers POST /calculate → advances to Step 2
2. All inputs contribute to the calculate request body

## Outputs
- `components/rebalance/ConfigPanel.tsx`

## Verify
- Mode selector renders as radio cards
- FullRebalanceWarning conditional on mode
- CashAmountInput shows/hides with toggle
- Calculate button sends correct request

## Handoff
→ TS.4.3 (Order review panel)
