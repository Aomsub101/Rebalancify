# TS.4.3 — ExecutionModeNotice

## Task
Build persistent non-dismissible banner shown in rebalance wizard Step 2 for non-Alpaca silos.

## Target
`components/shared/ExecutionModeNotice.tsx`

## Inputs
- `docs/architecture/components/04_broker_integration_layer/08-execution_mode_notice.md`

## Process
1. Create `components/shared/ExecutionModeNotice.tsx`:
   - Props: `{ platformName: string }`
   - Text: "These orders will not be submitted automatically. After reviewing, you will execute them manually on [Platform Name]."
   - Non-dismissible: no close button, no dismiss handler
   - Amber/info banner styling
   - Rendered in OrderReviewPanel (Step 2) when silo.platform_type !== 'alpaca'
2. This replaces the auto-execution expectation for non-Alpaca silos in v1.0
3. In v2.0 (Component 09), this notice is removed for platforms that gain execution support

## Outputs
- `components/shared/ExecutionModeNotice.tsx`

## Verify
- Appears for BITKUB, InnovestX, Schwab, Webull, Manual silos
- Hidden for Alpaca silos
- Cannot be dismissed

## Handoff
→ Sprint 5 (Testing)
