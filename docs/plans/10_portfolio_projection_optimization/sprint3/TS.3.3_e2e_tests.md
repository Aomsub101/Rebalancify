# TS.3.3 — E2E Tests

## Task
Write Playwright E2E tests for the full simulation flow.

## Target
`tests/e2e/simulation.spec.ts`

## Process
1. `tests/e2e/simulation.spec.ts`:
   - **Button disabled:** Silo with < 2 assets → button disabled with tooltip
   - **Button enabled:** Silo with 2+ qualified assets → button enabled
   - **Simulation flow:** Click Simulate → spinner → 3 strategy cards appear
   - **SimulationDisclaimer:** Non-collapsible banner visible above results
   - **TruncationWarning:** Mock short history → warning shown with limiting ticker
   - **StrategyCard:** Each shows name, weights, return_3m, range
   - **Apply Weights:** Click "Apply Weights" → weight cells populated
   - **No API on Apply:** Verify no /api/target-weights call on Apply (only on Save)
   - **Dirty guard:** Apply weights → navigate away → beforeunload fires
   - **Save flow:** Apply → Save → weights persisted → dirty guard cleared
2. Mock Railway API via Playwright route interception

## Outputs
- `tests/e2e/simulation.spec.ts`

## Verify
- `pnpm test:e2e -- simulation.spec.ts` passes all tests

## Handoff
→ Component 10 complete — all components planned
