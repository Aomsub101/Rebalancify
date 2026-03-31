# Regression Testing Procedure — Rebalancify

> **When to run this procedure:** Before any release (PR merge to main), after any `pnpm test` failure, or when touching any Tier 1/2 file listed below.
> **CI:** This procedure runs automatically on every push via GitHub Actions. Run locally before pushing.

---

## 1. Overview

Rebalancify regression testing is split into three tiers based on business criticality. Higher tiers run less frequently but take longer.

| Tier | What | When to run | Run time |
|------|------|-------------|----------|
| **Tier 1** | Core business logic (rebalancing calc, drift, encryption, FX) | Every push, every PR | ~30s |
| **Tier 2** | API route integration (silos, holdings, sync, execute) | Every push, every PR | ~60s |
| **Tier 3** | Extended features (news, RAG, LLM, PDF, knowledge) | Major releases only | ~30s |
| **E2E** | Playwright smoke (auth, rebalance wizard, silo creation) | Every push, every PR | ~120s |

---

## 2. Pre-Regression Checklist

Complete these before running any tier:

- [ ] All external API keys are **mocked** (Finnhub, CoinGecko, Alpaca, Bitkub, Schwab, Webull) — no live broker calls
- [ ] `ENCRYPTION_KEY` env var is set (required for encryption tests)
- [ ] Database is not required for Vitest unit/integration tests (all use mocked Supabase)
- [ ] No `.env.test` file is needed (Vitest mocks all external dependencies)
- [ ] Chromium browser is installed for Playwright: `pnpm playwright install chromium`

---

## 3. Running Regression

### Full local regression
```bash
pnpm typecheck && pnpm test && pnpm test:coverage && pnpm test:e2e
```

### By tier
```bash
# Tier 1 + Tier 2 (Vitest)
pnpm test

# Coverage report
pnpm test:coverage

# E2E smoke (requires dev server running)
pnpm test:e2e
```

### CI pipeline (GitHub Actions)
```
push to any branch → typecheck → test → build → deploy preview
push to main      → typecheck → test → build → deploy production
```

---

## 4. Test Inventory

### Tier 1 — Core Business Logic

These files contain pure business logic. They must never break. All use Vitest.

| File | Suite | What it covers | Run time | Failure impact |
|------|-------|---------------|----------|----------------|
| `lib/rebalanceEngine.test.ts` | 9 suites | Partial/full rebalancing, cash injection, silo isolation, performance | ~5s | **Critical** — wrong buy/sell orders |
| `lib/drift.test.ts` | 12 cases | Green/yellow/red drift classification, exact threshold boundaries | ~2s | **Critical** — wrong UI colour signals |
| `lib/__tests__/formatNumber.test.ts` | 14 cases | Price, weight, drift, quantity formatting; non-finite fallback | ~2s | **Critical** — wrong financial display |
| `lib/encryption.test.ts` | AES round-trip | Encrypt/decrypt with valid/invalid keys; auth tag tampering | ~2s | **Critical** — API key exposure |
| `lib/fxRates.test.ts` | FX parsing | `parseExchangeRates()`, `rateToUsd()` (truncation not rounding) | ~2s | **Critical** — wrong THB→USD conversion |
| `lib/priceService.test.ts` | Price caching | Three-tier cache; source resolution; zero-price error | ~3s | **High** — stale/wrong prices |
| `lib/driftDigest.test.ts` | Digest HTML | `buildDriftDigestHtml()`, `escapeHtml()` | ~2s | **Medium** — broken email digest |
| `lib/bitkub.test.ts` | BITKUB parsing | Signature, wallet, ticker parsing | ~2s | **High** — wrong BITKUB holdings |
| `lib/schwab.test.ts` | Schwab parsing | OAuth token, positions parsing | ~2s | **High** — wrong Schwab holdings |
| `lib/innovestx.test.ts` | InnovestX parsing | Settrade OAuth, HMAC digital, portfolio parsing | ~2s | **High** — wrong InnovestX holdings |
| `lib/webull.test.ts` | Webull parsing | HMAC signature, positions parsing | ~2s | **High** — wrong Webull holdings |

### Tier 2 — API Route Integration

All use Vitest calling route handlers directly (no HTTP, no live DB).

| File | Suite | What it covers | Run time | Failure impact |
|------|-------|---------------|----------|----------------|
| `app/api/silos/__tests__/route.test.ts` | POST/GET silos | Create silo, 5-silo limit, auth | ~3s | **Critical** — cannot create/manage silos |
| `app/api/silos/[silo_id]/__tests__/sync.test.ts` | POST/GET sync | Manual-silo rejection, Alpaca/Bitkub/Schwab/Webull sync, **holdings isolation** | ~10s | **Critical** — wrong holdings per platform |
| `app/api/silos/[silo_id]/asset-mappings/__tests__/route.test.ts` | Asset mappings CRUD | Create, confirm, list mappings | ~3s | **High** — duplicate asset ticker errors |
| `app/api/silos/[silo_id]/holdings/__tests__/route.test.ts` | Holdings CRUD | Manual holdings, derived value computation | ~3s | **High** — wrong holdings data |
| `app/api/silos/[silo_id]/holdings/[holding_id]/__tests__/route.test.ts` | Single holding | Update, delete holding | ~3s | **Medium** — stale holdings |
| `app/api/silos/[silo_id]/target-weights/__tests__/route.test.ts` | Target weights | Sum ≤ 100% validation, atomic replacement | ~3s | **Critical** — invalid portfolio weights |
| `app/api/silos/[silo_id]/drift/__tests__/route.test.ts` | Drift API | Live drift computation, threshold breach | ~3s | **High** — wrong drift display |
| `app/api/silos/[silo_id]/rebalance/execute/__tests__/route.test.ts` | Rebalance execute | Session state machine (pending/approved/partial/cancelled), Alpaca submission | ~5s | **Critical** — wrong order execution |
| `app/api/silos/[silo_id]/rebalance/history/__tests__/route.test.ts` | Rebalance history | Session list, immutable session fields | ~3s | **Medium** — missing history |
| `app/api/rebalance/history/__tests__/route.test.ts` | Global history | All-silo rebalance sessions | ~3s | **Medium** |
| `app/api/profile/__tests__/route.test.ts` | Profile endpoint | User profile, broker credentials | ~3s | **High** — broken settings |
| `app/api/fx-rates/__tests__/route.test.ts` | FX rates endpoint | Rate fetching, caching | ~3s | **High** — wrong FX conversion |
| `app/api/news/portfolio/__tests__/route.test.ts` | Portfolio news | News for held assets | ~3s | **Low** |
| `app/api/news/macro/__tests__/route.test.ts` | Macro news | General market news | ~3s | **Low** |
| `app/api/market/top-movers/__tests__/route.test.ts` | Top movers | Gainers/losers | ~3s | **Low** |
| `app/api/assets/search/__tests__/route.test.ts` | Asset search | Ticker search | ~3s | **Medium** |
| `app/api/assets/[asset_id]/peers/__tests__/route.test.ts` | Asset peers | Peer companies | ~3s | **Low** |
| `app/api/research/[ticker]/__tests__/route.test.ts` | Research endpoint | Allocation guard, LLM research | ~3s | **High** — research feature |
| `app/api/knowledge/upload/__tests__/route.test.ts` | Knowledge upload | PDF RAG ingest | ~3s | **Low** |

### Tier 3 — Extended Features

Run only when those features are touched (news, RAG pipeline, LLM routing, PDF parsing).

| File | Suite | Run time |
|------|-------|----------|
| `lib/newsService.test.ts` | News fetching + caching | ~5s |
| `lib/newsQueryService.test.ts` | News query + filtering | ~3s |
| `lib/llmProviders.test.ts` | LLM provider config | ~2s |
| `lib/llmRouter.test.ts` | LLM routing logic | ~2s |
| `lib/pdfParser.test.ts` | PDF text extraction | ~3s |
| `lib/ragIngest.test.ts` | RAG chunking + embedding | ~5s |

### E2E Smoke (Playwright)

Requires `pnpm dev` running on `http://localhost:3000`. Uses `page.route()` to mock all API responses.

| File | Suite | What it covers | Run time |
|------|-------|---------------|----------|
| `tests/example.spec.ts` | Suite verification | Playwright + browser sanity | ~30s |
| `tests/rebalance-wizard.spec.ts` | Rebalance wizard | 3-step wizard: mode select → order review → ConfirmDialog execute | ~90s |

---

## 5. Critical Assertions Checklist

Before marking any Tier 1 or Tier 2 test as passing, verify:

### Rebalance Engine (`lib/rebalanceEngine.test.ts`)
- [ ] Partial mode: buy orders scaled proportionally to available cash
- [ ] Full mode: `balance_valid=false` returned when capital insufficient
- [ ] Sell quantity never exceeds current holding quantity
- [ ] Zero-price assets skipped without error
- [ ] Empty holdings → empty orders (no crash)
- [ ] Silo isolation: two inputs produce independent results
- [ ] Performance: 50 holdings complete in < 2000ms

### Drift (`lib/drift.test.ts`)
- [ ] `ABS(drift) <= threshold` → `green`
- [ ] `threshold < ABS(drift) <= threshold + 2` → `yellow`
- [ ] `ABS(drift) > threshold + 2` → `red`
- [ ] Exact boundary values at `threshold` and `threshold + 2`

### Format Number (`lib/__tests__/formatNumber.test.ts`)
- [ ] `price`: 2dp, `$` prefix for USD
- [ ] `weight`: 2dp with `%` suffix
- [ ] `drift`: signed 2dp with `+`/`-` prefix
- [ ] `quantity` (stock): 0dp for integers, up to 4dp
- [ ] `quantity` (crypto): always 8dp
- [ ] Non-finite → `'—'`

### Encryption (`lib/encryption.test.ts`)
- [ ] Round-trip: `decrypt(encrypt(plaintext)) === plaintext`
- [ ] Wrong key throws
- [ ] Tampered auth tag throws

### FX Rates (`lib/fxRates.test.ts`)
- [ ] `rateToUsd` uses `1/conversion_rate` (not `conversion_rate`)
- [ ] Truncation to 8dp, not rounding

### Silo Sync (`app/api/silos/[silo_id]/__tests__/sync.test.ts`)
- [ ] Manual silo → 422 `MANUAL_SILO_NO_SYNC`
- [ ] API silo holdings filtered by `${platform_type}_sync` source (not leaked to other platforms)
- [ ] Manual silo returns all holdings regardless of source
- [ ] Alpaca → 403 `ALPACA_NOT_CONNECTED` when no key
- [ ] Alpaca → 503 `BROKER_UNAVAILABLE` on network error
- [ ] Bitkub/Schwab/Webull → same credential and network error codes

### Rebalance Execute (`app/api/silos/[silo_id]/rebalance/execute/__tests__/route.test.ts`)
- [ ] Zero approvals → session `cancelled`
- [ ] All succeed → session `approved`
- [ ] Some fail → session `partial`
- [ ] `snapshot_after` written only after execution completes

---

## 6. Coverage Gates

The following minimum coverage thresholds are enforced in CI:

| File | Minimum coverage |
|------|-----------------|
| `lib/rebalanceEngine.ts` | 90% |
| `lib/encryption.ts` | 100% |
| `lib/formatNumber.ts` | 95% |
| `lib/priceService.ts` | 80% |
| All other `lib/*.ts` | 80% |
| All `app/api/**/*.ts` | 70% |

Run `pnpm test:coverage` to check. Coverage reports are output to `coverage/` (HTML) and `coverage/coverage-final.json` (CI upload).

---

## 7. Manual Security Checks

These cannot be automated in Vitest — run manually before each release:

### RLS Isolation
```sql
-- Verify row-level security blocks cross-user access
-- Run against a test Supabase instance

-- 1. As user-1, create a silo
INSERT INTO silos (id, user_id, name, platform_type, is_active)
VALUES ('silo-test-rls', 'user-1', 'Test', 'manual', true);

-- 2. As user-2, try to read user-1's silo
SELECT * FROM silos WHERE id = 'silo-test-rls';
-- Must return 0 rows

-- 3. As user-2, try to read user-1's holdings
SELECT * FROM holdings WHERE silo_id = 'silo-test-rls';
-- Must return 0 rows
```

### API Key Never in Browser
```bash
# 1. Open browser DevTools → Network tab
# 2. Connect a new broker (Alpaca/Bitkub/Schwab/Webull)
# 3. Save credentials
# 4. Verify NO API key appears in:
#    - Network request bodies
#    - URL query parameters
#    - console.log output
#    - localStorage/sessionStorage
```

### LIVE Badge Visibility
```bash
# 1. Set Alpaca mode to 'live' in user_profiles
# 2. Open silo card UI
# 3. Verify amber "LIVE" badge is visible
# 4. Verify badge cannot be dismissed
```

---

## 8. Adding New Tests

### TDD Order (mandatory for `lib/` code)
1. **Red:** Write a failing test that describes the expected behavior
2. **Green:** Write the minimum implementation to pass
3. **Refactor:** Clean up without breaking the test

### Test file naming
- Vitest unit/integration: `*.test.ts` in same directory as implementation
- Playwright E2E: `tests/*.spec.ts`

### Test patterns
- **Pure functions** (`lib/rebalanceEngine.ts`, `lib/drift.ts`): test inputs → outputs directly
- **API routes** (`app/api/...`): call handler function directly with mocked Supabase + `createMockRequest()`
- **E2E** (`tests/*.spec.ts`): use `page.route()` to mock external APIs, `page.goto()` for navigation

### Mocking Supabase in API route tests
```typescript
// Pattern used throughout this codebase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => mockFrom(table)),
  })),
}))
```

---

## 9. Troubleshooting

| Problem | Likely cause | Fix |
|---------|-------------|-----|
| `ENCRYPTION_KEY_MISSING` in tests | Env var not stubbed | `vi.stubEnv('ENCRYPTION_KEY', 'a'.repeat(64))` |
| `fetch` not mocked in route tests | `vi.stubGlobal('fetch', mockFetch)` not called | Add before each test that calls external APIs |
| Playwright tests timeout | Dev server not running | Start with `pnpm dev` before `pnpm test:e2e` |
| Coverage below threshold | New code without tests | Add tests before marking done |
| `createClient` not mocked | Module mock path wrong | Verify `vi.mock('@/lib/supabase/server')` matches import |
