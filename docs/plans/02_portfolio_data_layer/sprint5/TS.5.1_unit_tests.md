# TS.5.1 — Unit Tests

## Task
Write unit tests for silo limit enforcement, drift three-state logic, and formatNumber.

## Target
`tests/unit/`

## Process
1. `tests/unit/silo-limit.test.ts`:
   - Mock DB count = 5 → POST /api/silos returns 422 SILO_LIMIT_REACHED
   - Mock DB count = 4 → POST succeeds
   - Soft delete does not count toward limit
2. `tests/unit/drift-calculation.test.ts`:
   - Green: drift_pct = 0, threshold = 5 → green
   - Yellow: drift_pct = 6.5, threshold = 5 → yellow (between 5 and 7)
   - Red: drift_pct = 8, threshold = 5 → red (> 7)
   - Negative drift values handled correctly
   - Edge cases: exactly at threshold boundaries
3. `tests/unit/format-number.test.ts`:
   - Currency formatting with symbol
   - Percent formatting with sign
   - Quantity: 8 decimals for crypto, 2 for stocks
   - Compact formatting (K, M, B)
   - Edge cases: zero, negative, very large numbers

## Outputs
- `tests/unit/silo-limit.test.ts`
- `tests/unit/drift-calculation.test.ts`
- `tests/unit/format-number.test.ts`

## Verify
- `pnpm test` — all tests pass

## Handoff
→ TS.5.2 (API integration tests)
