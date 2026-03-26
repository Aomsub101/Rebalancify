# docs/development/03-testing-strategy.md — Testing Strategy

## AGENT CONTEXT

**What this file is:** The testing approach — what to test, how to test it, and the minimum coverage required for each story to be considered done.
**Derived from:** PRD_v1.3.md Section 7 (NFRs), TECH_DOCS_v1.2.md (DOC-05)
**Connected to:** stories/STORY-TEMPLATE.md (Definition of Done — testing requirements)
**Critical rules for agents using this file:**
- Silo isolation must be tested with a two-silo scenario in every calculation test.
- RLS must be verified with a two-user scenario for every story that touches user-data tables.
- The pre-flight balance validation failure case (HTTP 422) must be tested before any story is marked done.

---

## Testing Pyramid

| Layer | Tool | Coverage Target | What Is Tested |
|---|---|---|---|
| Unit | Vitest | 80% of `lib/` | Calculation engine, formatNumber, encryption, price service |
| Integration | Vitest + Supabase local | Key API routes | Endpoint → DB round trips |
| E2E | Playwright | Critical paths only | Auth flow, silo creation, rebalancing wizard |
| Manual | Browser + DB queries | Security: RLS, key handling | Cross-user data access, key encryption round trip |
| Visual (optional) | Playwright screenshots | Design tokens only | Light/dark mode rendering after STORY-003; re-run when tokens change |

**Visual regression testing is optional but strongly recommended.** Run after STORY-003 (AppShell) is complete and whenever `app/globals.css` or `tailwind.config.ts` changes. It is not a required DoD item.

---

## Unit Test Requirements

### rebalanceEngine.ts (most critical)

Every new calculation story must include unit tests for:

1. **Partial mode — normal case:** holdings + weights → correct buy/sell quantities that do not overspend cash.
2. **Full mode — exact weights:** holdings + weights → computed post-execution weights within ±0.01% of targets.
3. **Silo isolation (MANDATORY):** Two silos with the same asset at different quantities. Calculation for silo A must not be affected by silo B's data.
4. **Pre-flight failure:** cash insufficient for buys → `balance_valid: false` with `balance_errors` populated.
5. **Weights ≠ 100%:** sum = 85% → `weights_sum_pct: 85`, `cash_target_pct: 15`, no error thrown.
6. **Cash injection:** include_cash = true, cash_amount = 500 → cash is added to the available capital.
7. **Empty orders:** all assets already at target weight (drift < rounding precision) → zero orders generated.

### formatNumber.ts

Tests for every format type: price USD, price THB, weight, drift (+/-), quantity stock, quantity crypto, staleness.

Edge cases: `0`, negative values, very large values (`999999999.99999999`), values requiring rounding.

### encryption.ts

1. Encrypt → decrypt round trip produces original plaintext.
2. Two encryptions of the same plaintext produce different ciphertexts (IV uniqueness).
3. Decrypt with wrong key throws an error.

---

## Integration Test Requirements

### Per Story — Minimum Tests

Every story that adds an API route must include integration tests for:

1. **Unauthenticated call** → HTTP 401.
2. **Happy path** → correct response shape, correct status code.
3. **RLS isolation** → user B's JWT cannot retrieve user A's data (for user-scoped tables).
4. **Error case** → the most likely error for that endpoint (e.g., SILO_LIMIT_REACHED, BALANCE_INSUFFICIENT).

### RLS Verification Procedure

Run this for every story touching a user-data table:

```sql
-- Step 1: Insert test data as user A
-- Step 2: Switch to user B's JWT context
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub": "[user_b_id]"}';
-- Step 3: Attempt to SELECT user A's data
SELECT * FROM silos WHERE id = '[user_a_silo_id]';
-- Expected: 0 rows
```

---

## E2E Test Scenarios (Playwright)

Maintain E2E tests for these critical paths:

1. **Auth:** signup → email verification → login → lands on Overview.
2. **First silo:** create silo → add asset via search modal → enter quantity → target weight → WeightsSumBar shows correct %.
3. **Alpaca rebalancing:** configure Alpaca key (paper) → sync silo → calculate (partial mode) → review orders → confirm → result step shows executed orders.
4. **Silo limit:** create 5 silos → verify "Create silo" button is disabled → delete one silo → button re-enables.

---

## Performance Test Requirements

These NFRs must be verified before each phase is marked complete:

| NFR | Target | Test Method |
|---|---|---|
| Rebalancing calculation | < 2 seconds for 50 holdings | Vitest timing assertion |
| News feed refresh | < 3 seconds | Playwright timing |
| First Contentful Paint | < 3 seconds on 3G | Lighthouse CI in Vercel preview |
| PWA offline mode | < 1 second | Service worker cache hit timing |

---

## Manual Security Tests (Per Story)

For every story in EPIC-03 (Alpaca), EPIC-04 (Broker Fetch), EPIC-09 (AI Research):

1. **Key never in network requests:** Open DevTools Network tab. Trigger a sync. Confirm zero requests to external APIs from the browser tab — only requests to `/api/...`.
2. **Key never in responses:** Call `GET /api/profile`. Confirm no `*_key`, `*_secret`, `*_access`, `*_refresh` fields in response. Only `*_connected: boolean`.
3. **Key masked after save:** Enter API key in Settings → save → confirm the input shows `••••••••` and no key value.

---

## Test-Driven Development (TDD)

All business logic in `lib/` MUST follow the Red → Green → Refactor cycle. This is not optional — it is the implementation order enforced by the Development Loop.

### The TDD Cycle (apply to every function in lib/)

```
RED   → Write a failing test that describes the behaviour you want.
         Run it. Confirm it fails with the expected error.
GREEN → Write the minimum code that makes the test pass.
         Run it. Confirm it passes.
REFACTOR → Clean up the code without breaking the test.
            Run tests again. Confirm still green.
```

**Why TDD for a financial app:** Rebalancing calculations, drift computations, and encryption operations have no UI to visually verify. A test that runs in milliseconds catches a rounding error in `rebalanceEngine.ts` instantly — a manual test on the UI might not catch it at all.

### What Must Use TDD (non-negotiable)

| File | Why TDD is mandatory |
|------|---------------------|
| `lib/rebalanceEngine.ts` | Financial calculation — a bug silently produces wrong orders |
| `lib/formatNumber.ts` | Number display — a bug corrupts all displayed values |
| `lib/encryption.ts` | Security — a bug exposes broker API keys |
| `lib/priceService.ts` | Cache logic — a bug over-calls external APIs and exhausts quotas |
| All `app/api/**/route.ts` | Business logic in route handlers — test the handler function in isolation |

### What Does NOT Require TDD

- React components (use snapshot or interaction tests instead)
- `app/globals.css` and `tailwind.config.ts` (no business logic)
- Migration SQL files (verified by running against local Supabase)

### TDD for API Route Handlers

Each route handler must have a corresponding test file. Test it by calling the handler function directly, not via HTTP:

```typescript
// app/api/silos/route.test.ts
import { POST } from './route'
import { createMockRequest } from '@/test-utils/mock-request'

describe('POST /api/silos', () => {
  it('returns 422 SILO_LIMIT_REACHED when user has 5 active silos', async () => {
    // RED: write this test first, before implementing the limit check
    const req = createMockRequest({ name: 'My Silo', platform_type: 'alpaca' })
    mockSupabaseCount(5) // mock DB returns count = 5
    const res = await POST(req)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('SILO_LIMIT_REACHED')
  })
})
```

### Running Tests

```bash
# Run all tests once
pnpm test

# Run tests in watch mode (use during TDD — keeps re-running on file save)
pnpm test:watch

# Run with coverage report
pnpm test:coverage

# Run only a specific file
pnpm test src/lib/rebalanceEngine.test.ts
```

### Coverage Requirements

| Area | Minimum Coverage |
|------|-----------------|
| `lib/rebalanceEngine.ts` | 90% (financial critical path) |
| `lib/encryption.ts` | 100% |
| `lib/formatNumber.ts` | 95% |
| `lib/priceService.ts` | 80% |
| All other `lib/` files | 80% |
| `app/api/**/route.ts` handlers | 70% |
| React components | No minimum — test critical interactions only |

---

## CI/CD with GitHub Actions

### What CI/CD Does

Every time you push a commit or open a Pull Request, GitHub automatically runs your tests and type-check. This catches bugs before they reach the `main` branch, so no broken code is ever deployed to Vercel.

**You do not need the GitHub CLI for this.** CI/CD is configured by adding a YAML file to your repository. GitHub reads it automatically.

### How It Works (no prior knowledge assumed)

1. You push a commit to GitHub.
2. GitHub sees the file at `.github/workflows/ci.yml` in your repo.
3. GitHub spins up a virtual machine, installs your dependencies, and runs your tests.
4. If all tests pass → green ✅. If any test fails → red ❌ and you get an email.
5. Vercel's deployment only runs after the CI check passes (configure this in Vercel → Project Settings → Git → "Require status checks").

### The CI Workflow File

The workflow file is created in **PART C** of this prompt as a new file at `rebalancify/.github/workflows/ci.yml`. It runs on every push and every pull request to `main`.

### Setting Up the Supabase Connection for CI

The CI environment needs to run against a Supabase instance for integration tests. Use a **separate** Supabase project for CI (never the production project):

1. Create a third Supabase project: "rebalancify-ci"
2. Run all migrations against it
3. In GitHub: repository Settings → Secrets and variables → Actions → add these secrets:
   - `CI_NEXT_PUBLIC_SUPABASE_URL` — the CI project URL
   - `CI_NEXT_PUBLIC_SUPABASE_ANON_KEY` — the CI project anon key
   - `CI_SUPABASE_SERVICE_ROLE_KEY` — the CI project service role key
   - `CI_ENCRYPTION_KEY` — a random 32-byte hex key for CI only

These secrets are injected as environment variables when GitHub runs your tests. They are never visible in logs.

### What the CI Pipeline Checks (in order)

1. TypeScript type-check (`pnpm type-check`) — catches type errors
2. Unit tests (`pnpm test`) — runs all Vitest tests
3. Build (`pnpm build`) — confirms the Next.js app compiles

Playwright E2E tests are NOT in CI by default — they require a running server and are slow. Run them locally before major releases.

### Branch Protection (recommended after first green CI run)

In GitHub → repository Settings → Branches → Add rule → Branch name pattern: `main`:
- ✅ Require status checks to pass before merging
- ✅ Select the "CI" status check
- ✅ Require branches to be up to date before merging

This prevents any code that fails tests from reaching `main`.
