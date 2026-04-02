# TS.5.4 — E2E Tests

## Task
Write Playwright E2E tests for the full rebalancing wizard flow.

## Target
`tests/e2e/rebalance.spec.ts`

## Process
1. `tests/e2e/rebalance.spec.ts`:
   - **Wizard flow:** Config → Calculate → Review → Execute → Result
   - **ConfirmDialog non-dismissible:** Click outside + Escape → stays open
   - **Skip orders:** Check skip boxes → skipped orders not submitted
   - **Manual mode:** Non-Alpaca silo → ExecutionModeNotice shown → manual instructions displayed
   - **Copy instructions:** Click CopyAll → toast appears
   - **History:** After execution → navigate to history → session visible
   - **Pre-flight failure:** Full mode + insufficient cash → error shown, stuck at Step 1
2. Mock Alpaca API for execution tests (no real trades)
3. Use authenticated Playwright storage state

## Outputs
- `tests/e2e/rebalance.spec.ts`

## Verify
- `pnpm test:e2e -- rebalance.spec.ts` passes all tests

## Handoff
→ Component 03 complete → Component 04 (Broker Integration Layer)
