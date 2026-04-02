# TS.5.1 — Unit Tests

## Task
Write unit tests for HMAC signature generation and credential validation logic.

## Target
`tests/unit/`

## Process
1. `tests/unit/bitkub-hmac.test.ts`:
   - Correct HMAC-SHA256 signature generation
   - Timestamp format validation
   - Edge cases: empty body, special characters
2. `tests/unit/innovestx-signature.test.ts`:
   - Correct compound message construction
   - HMAC signature matches expected output
   - Both equity (OAuth) and digital (HMAC) branches
3. `tests/unit/schwab-oauth.test.ts`:
   - CSRF state generation and validation
   - Token exchange request format
   - Token expiry calculation
4. `tests/unit/webull-hmac.test.ts`:
   - Correct signature over timestamp+method+path
   - Header construction

## Outputs
- `tests/unit/bitkub-hmac.test.ts`
- `tests/unit/innovestx-signature.test.ts`
- `tests/unit/schwab-oauth.test.ts`
- `tests/unit/webull-hmac.test.ts`

## Verify
- `pnpm test` — all pass

## Handoff
→ TS.5.2 (Integration tests)
