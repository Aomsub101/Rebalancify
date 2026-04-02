# TS.3.2 — Frontend Tests

## Task
Write Vitest tests for constraint hook, deduplication logic, and TypeScript type validation.

## Target
`tests/unit/`

## Process
1. `tests/unit/simulation-constraints.test.ts`:
   - < 2 assets → disabled with reason
   - Asset with market_debut_date < 3 months ago → disabled
   - Asset with market_debut_date = null → disabled
   - 2+ assets all with sufficient history → enabled
2. `tests/unit/simulation-dedup.test.ts`:
   - Same ticker set → deduplication prevents re-call
   - Different ticker set → new call allowed
   - Ticker order doesn't matter (sorted comparison)
3. `tests/unit/simulation-types.test.ts`:
   - SimulationResult interface matches API response
   - Weight record parsing
   - Percentage string formatting

## Outputs
- `tests/unit/simulation-constraints.test.ts`
- `tests/unit/simulation-dedup.test.ts`
- `tests/unit/simulation-types.test.ts`

## Verify
- `pnpm test` — all pass

## Handoff
→ TS.3.3 (E2E tests)
