# TS.5.3 — E2E Tests

## Task
Write Playwright E2E tests for broker settings and sync flows.

## Target
`tests/e2e/brokers.spec.ts`

## Process
1. `tests/e2e/brokers.spec.ts`:
   - **Settings page sections:** All 5 broker sections render
   - **BITKUB connect:** Enter keys → save → ConnectionStatusDot turns green
   - **Masked inputs:** After save, inputs show `••••••••`
   - **Sync button:** Create BITKUB silo → SyncButton visible → click → holdings appear
   - **ExecutionModeNotice:** Non-Alpaca silo rebalance → banner appears
   - **Schwab OAuth:** Click Connect → redirect to Schwab (mock) → callback → connected
   - **TokenExpiryWarning:** Mock expired token → warning banner appears in Settings
   - **Disconnect:** Click disconnect → status dot turns grey
2. Mock broker APIs via Playwright route interception

## Outputs
- `tests/e2e/brokers.spec.ts`

## Verify
- `pnpm test:e2e -- brokers.spec.ts` passes all tests

## Handoff
→ Component 04 complete → Component 05 (Market Data & Pricing)
