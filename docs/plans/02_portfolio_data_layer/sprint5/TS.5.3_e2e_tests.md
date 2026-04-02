# TS.5.3 — E2E Tests

## Task
Write Playwright E2E tests for the full silo lifecycle.

## Target
`tests/e2e/portfolio.spec.ts`

## Process
1. `tests/e2e/portfolio.spec.ts`:
   - **Create silo flow:** Login → /silos → click Create → fill form → submit → redirected to silo detail
   - **Add asset:** Click "Add Asset" → search "AAPL" → confirm → holding row appears
   - **Set target weight:** Edit weight column → enter 50% → save → WeightsSumBar updates
   - **View drift:** Navigate to silo detail → drift badges visible for each holding
   - **Overview aggregation:** Navigate to /overview → total value, silo count correct
   - **USD toggle:** Toggle on → values change to USD → toggle off → values revert
   - **5-silo limit:** Create 5 silos → "Create" button disabled → 6th attempt blocked
2. Use authenticated Playwright storage state from Component 01 tests

## Outputs
- `tests/e2e/portfolio.spec.ts`

## Verify
- `pnpm test:e2e -- portfolio.spec.ts` passes all tests

## Handoff
→ TS.5.4 (Dirty guard)
