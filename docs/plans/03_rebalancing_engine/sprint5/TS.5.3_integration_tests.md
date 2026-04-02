# TS.5.3 — Integration Tests

## Task
Write integration tests for the calculate → execute flow with DB assertions.

## Target
`tests/integration/`

## Process
1. `tests/integration/rebalance-flow.test.ts`:
   - Setup: create silo, add holdings + weights
   - Calculate: POST /calculate → session created with status 'pending'
   - Execute all: POST /execute → session status 'approved'
   - Execute partial (skip some): → session status matches orders
   - Execute none (all skipped): → session status 'cancelled'
   - Snapshot immutability: verify snapshot_before unchanged after execute
2. `tests/integration/alpaca-sync.test.ts`:
   - Mock Alpaca API responses
   - Sync populates holdings correctly
   - Cash balance updated
   - last_synced_at updated
   - Invalid credentials → 401
3. `tests/integration/rebalance-sessions-immutability.test.ts`:
   - Only status and snapshot_after updated
   - No updated_at column exists
   - grep 'UPDATE.*rebalance_sessions' → only execute route

## Outputs
- `tests/integration/rebalance-flow.test.ts`
- `tests/integration/alpaca-sync.test.ts`
- `tests/integration/rebalance-sessions-immutability.test.ts`

## Verify
- All integration tests pass

## Handoff
→ TS.5.4 (E2E tests)
