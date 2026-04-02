# TS.5.2 — Integration Tests

## Task
Write integration tests for all broker sync flows with mocked broker APIs.

## Target
`tests/integration/`

## Process
1. `tests/integration/bitkub-sync.test.ts`:
   - Mock BITKUB API responses (wallet + ticker)
   - Verify holdings upserted, cash balance updated, prices cached
   - BITKUB unavailable → 503 BROKER_UNAVAILABLE
   - No credentials → 403 BITKUB_NOT_CONNECTED
2. `tests/integration/innovestx-sync.test.ts`:
   - Mock Settrade OAuth + portfolio response (equity branch)
   - Mock digital asset API response (digital branch)
   - One branch fails → other still executes
   - Missing credentials → warning in sync_warnings[]
3. `tests/integration/schwab-sync.test.ts`:
   - Mock OAuth callback (token exchange)
   - Mock positions fetch
   - Expired token → 401 SCHWAB_TOKEN_EXPIRED
4. `tests/integration/webull-sync.test.ts`:
   - Mock Webull positions API
   - Network failure → 503 BROKER_UNAVAILABLE

## Outputs
- `tests/integration/bitkub-sync.test.ts`
- `tests/integration/innovestx-sync.test.ts`
- `tests/integration/schwab-sync.test.ts`
- `tests/integration/webull-sync.test.ts`

## Verify
- All integration tests pass with mocked APIs

## Handoff
→ TS.5.3 (E2E tests)
