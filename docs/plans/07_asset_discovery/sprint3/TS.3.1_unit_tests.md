# TS.3.1 — Unit Tests

## Task
Write unit tests for peer fallback logic, top movers formatting, and color signals.

## Target
`tests/unit/`

## Process
1. `tests/unit/peers-fallback.test.ts`:
   - Finnhub available → Finnhub peers used
   - Finnhub unavailable → sector_taxonomy.json fallback used
   - Unknown sector → empty peers (no error)
2. `tests/unit/top-movers-format.test.ts`:
   - Gainers: positive change_pct, correct color assignment
   - Losers: negative change_pct, correct color assignment
   - Stale flag propagation
3. `tests/unit/drift-summary.test.ts`:
   - Multiple silos aggregated correctly
   - DriftBadge states match per-asset drift

## Outputs
- `tests/unit/peers-fallback.test.ts`
- `tests/unit/top-movers-format.test.ts`
- `tests/unit/drift-summary.test.ts`

## Verify
- `pnpm test` — all pass

## Handoff
→ TS.3.2 (E2E tests)
