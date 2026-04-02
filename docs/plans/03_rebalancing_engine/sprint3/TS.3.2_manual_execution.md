# TS.3.2 — Manual Execution Instructions

## Task
Generate human-readable manual execution instructions for non-Alpaca silos.

## Target
`lib/manualInstructions.ts`

## Inputs
- TS.3.1 outputs (execute route marks orders as 'manual')
- `docs/architecture/components/03_rebalancing_engine/09-execution_result_panel.md`

## Process
1. Create `lib/manualInstructions.ts`:
   - `generateManualInstructions(orders, platformName)`:
     - For each order: "Buy X shares of AAPL on [Platform Name]." or "Sell X shares..."
     - Format quantities: stocks = whole shares, crypto = up to 8 decimals
     - Include estimated value for reference
   - Return array of instruction strings
2. Used by:
   - Execute route response (for non-Alpaca silos)
   - ExecutionResultPanel Step 3 UI (CopyAllButton, CopyRowButton)
3. Instructions are display-only — no API calls to external brokers in v1.0

## Outputs
- `lib/manualInstructions.ts`

## Verify
- Correct instruction text for buy/sell orders
- Platform name inserted correctly
- Quantities formatted per asset type

## Handoff
→ TS.3.3 (ConfirmDialog)
