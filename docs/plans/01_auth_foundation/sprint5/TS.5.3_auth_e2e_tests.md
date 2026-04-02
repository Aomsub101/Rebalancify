# TS.5.3 — Auth E2E Tests

## Task
Write Playwright E2E tests covering the complete auth flow.

## Target
`tests/e2e/auth.spec.ts`

## Inputs
- TS.2.3 outputs (auth pages)
- TS.2.4 outputs (middleware)
- TS.5.2 outputs (Playwright config)

## Process
1. Create `tests/e2e/auth.spec.ts` with test cases:
   - **Login success:** Navigate to `/login` → enter valid credentials → submit → redirected to `/overview`
   - **Login failure:** Enter invalid credentials → error message shown → no redirect
   - **Unauthenticated redirect:** Navigate to `/overview` without session → redirected to `/login`
   - **Signup flow:** Navigate to `/signup` → fill form → submit → success message shown
   - **Reset password:** Navigate to `/reset-password` → enter email → submit → confirmation shown
   - **Sign out:** Click UserMenu sign-out → redirected to `/login` → `/overview` inaccessible
   - **Session persistence:** Login → close tab → reopen `/overview` → still authenticated
2. Use Playwright storage state for authenticated tests (avoid re-login per test)
3. Create `tests/e2e/fixtures/auth.ts` for login helper

## Outputs
- `tests/e2e/auth.spec.ts`
- `tests/e2e/fixtures/auth.ts`

## Verify
- `pnpm test:e2e -- auth.spec.ts` passes all tests
- Screenshots captured on any failure

## Handoff
→ TS.5.4 (RLS integration tests)
