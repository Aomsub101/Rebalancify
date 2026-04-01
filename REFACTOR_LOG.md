# REFACTOR_LOG.md — Component Decoupling Refactoring

> Tracks progress through DOCS/architecture/refactoring_plan.md phases.
> Each entry records: phase completed, files touched, verification results.

---

## Phase 1 — Shared Types & Orphan Code

### Phase 1a — Move `DriftAsset` to shared types ✅

**Completed:** 2026-04-01

**Changes:**

- NEW: `lib/types/portfolio.ts` — canonical `DriftAsset` interface exported here
- MODIFIED: `components/overview/PortfolioSummaryCard.tsx` — removed inline `DriftAsset`; added `import type { DriftAsset } from '@/lib/types/portfolio'`
- MODIFIED: `components/silo/SiloCard.tsx` — updated import from `@/components/overview/PortfolioSummaryCard` → `@/lib/types/portfolio`
- MODIFIED: `components/overview/GlobalDriftBanner.tsx` — updated import from `./PortfolioSummaryCard` → `@/lib/types/portfolio`
- MODIFIED: `app/(dashboard)/overview/page.tsx` — updated import from `@/components/overview/PortfolioSummaryCard` → `@/lib/types/portfolio`

**Note:** `discover/page.tsx` has its own local `DriftAsset` interface with different shape (`current_weight_pct`, `target_weight_pct`) — not touched per plan.

**Verification:** `tsc --noEmit` ✅ | `pnpm test` — 57 test files, 562 tests ✅

---

### Phase 1b — Orphaned `lib/priceHistory.ts` ✅

**Completed:** 2026-04-01

**Changes:**

- MODIFIED: `lib/priceHistory.ts` — added `// TODO(STORY-044): activate this` comment

**Pre-Check:** `grep -rn "priceHistory|fetchPriceHistory"` confirmed no import sites beyond `lib/priceHistory.ts` and `lib/priceHistory.test.ts` (self-references only). Per plan §Phase 1b: treated as future-use stub, not deleted.

**Verification:** `tsc --noEmit` ✅ | `pnpm test` ✅

---

### Phase 1c — Simulation Types Completeness ✅ NO-OP

**Completed:** 2026-04-01

**Pre-Check:** Verified `lib/types/simulation.ts` fields exactly match Railway `api/optimize.py` `run_optimization()` return value:

- `strategies.not_to_lose/expected/optimistic` → `SimulationStrategy` ✅
- `metadata.is_truncated_below_3_years` → `boolean` ✅
- `metadata.limiting_ticker` → `string` ✅
- `metadata.lookback_months` → `number` ✅
- `app/api/optimize/route.ts` — pure passthrough (no caching, no transformation) ✅
- Components (`SimulationResultsTable`, `SiloDetailView`) import from `lib/types/simulation` ✅

**Verification:** `tsc --noEmit` ✅

---

## Phase 2 — Encryption Adapter Extraction ✅

**Completed:** 2026-04-01

**Changes:**

- NEW: `lib/encryption/index.ts` — `IEncryption` interface + singleton re-export of `encrypt`/`decrypt` from adapter
- NEW: `lib/encryption/adapter.ts` — AES-256-GCM implementation (moved from `lib/encryption.ts`; unchanged)
- NEW: `lib/encryption/encryption.test.ts` — rewritten to import from `./adapter` (tests 3 required properties)
- DELETED: `lib/encryption.ts` — moved to `lib/encryption/adapter.ts`
- DELETED: `lib/encryption.test.ts` — replaced by `lib/encryption/encryption.test.ts`

**Import sites verified (import path unchanged — all already used `@/lib/encryption`):**

- `app/api/auth/schwab/callback/route.ts` — `{ encrypt }`
- `app/api/profile/route.ts` — `{ encrypt }`
- `app/api/research/[ticker]/route.ts` — `{ decrypt }`
- `app/api/research/[ticker]/__tests__/route.test.ts` — `{ decrypt }`
- `app/api/silos/[silo_id]/sync/route.ts` — `{ decrypt }`
- `app/api/silos/[silo_id]/__tests__/sync.test.ts` — `{ encrypt }`
- `app/api/silos/[silo_id]/rebalance/execute/route.ts` — `{ decrypt }`
- `app/api/silos/[silo_id]/rebalance/execute/__tests__/route.test.ts` — `{ encrypt }`

**Note:** Call sites use 2-argument pattern `(value, key)` throughout. Singleton interface preserved this signature to avoid rewriting all 8 route/test files. Interface surfaces every call site at compile time if adapter ever changes.

**Verification:** `tsc --noEmit` ✅ | `pnpm test lib/encryption/encryption.test.ts` — 3 tests ✅ | `pnpm test` — 57 test files, 562 tests ✅

---

## Phase 3 — Eliminate Drift Logic Duplication ✅ NO-OP

**Completed:** 2026-04-01

**Pre-Check:** `grep -n "drift_state\|computeDriftState\|drift_pct.*green\|drift_pct.*yellow\|drift_pct.*red" app/api/cron/drift-digest/route.ts` — no matches

**Finding:**`cron/drift-digest/route.ts` uses a binary breach check (`drift > silo.drift_threshold`) — it never implemented green/yellow/red classification because its purpose is breach detection for email digest, not three-state UI classification. `computeDriftState` lives correctly in `lib/drift.ts` and is used by `holdings/route.ts` and `drift/route.ts`. The duplication noted in B-2 never existed in this form.

**Verification:**`tsc --noEmit` ✅ | `pnpm test lib/drift.test.ts` — 9 tests ✅

---

## Phase 4 — Top-Movers Service Extraction ✅

**Completed:** 2026-04-01

**Changes:**

- NEW: `lib/topMoversService.ts` — extracted service (FMP, Finnhub, CoinGecko, stale-cache helpers); `fetchTopMovers(type)` returns `null` on all-source failure; stale-cache handled by caller
- NEW: `lib/topMoversService.test.ts` — 8 TDD tests: FMP→Finnhub fallback, Finnhub failure, all-sources-null, correct price/change_pct shape, CoinGecko success/failure
- MODIFIED: `app/api/market/top-movers/route.ts` — reduced from 366 lines to ~65; thin auth+validation wrapper; stale-cache fallback delegated to `fetchStaleCache()`
- MODIFIED: `components/discover/TopMoversTable.tsx` — replaced local `TopMoverItem` interface with `import { TopMoverItem } from '@/lib/topMoversService'`
- FIXED: `app/api/market/top-movers/__tests__/route.test.ts` — corrected two `makeStaleDb()` mock chains (`.select().eq().limit()` not `.select().eq().select().limit()`)

**Note:** `fetchTopMovers(type)` accepts no SupabaseClient parameter — stale-cache fallback is handled by the thin wrapper, not the service, per audit review.

**Verification:** `tsc --noEmit` ✅ | `pnpm test lib/topMoversService.test.ts` — 8 tests ✅ | `pnpm test app/api/market/top-movers/__tests__/route.test.ts` — 10 tests ✅ | `pnpm test` — 58 files, 570 tests ✅

---

## Phase 5 — News Route Auth Pattern Normalization

**Status:** ✅ COMPLETED
**Completed:** 2026-04-01

### Phase 5a — Document Bearer-token workaround ✅

- MODIFIED: `lib/supabase/server.ts` — added documentation comment explaining news routes use direct `@supabase/supabase-js` client with Bearer-token auth (not `createServerClient()`) because TanStack Query `useQuery` fires from client components with no cookie jar server-side

### Phase 5b — Create typed news query client ✅

- MODIFIED: `lib/newsQueryService.ts` — added `createNewsClient(bearerToken)` factory function; updated file docblock with B-6 architecture note
- MODIFIED: `lib/newsQueryService.test.ts` — added 3 TDD tests for `createNewsClient`: Bearer token passed in Authorization header, returns SupabaseClient-shaped object, creates new client per call (no caching)

### Phase 5c — Normalize Bearer-token routes ✅

- MODIFIED: `app/api/news/articles/[article_id]/state/route.ts` — replaced 5-line inline `createClient(...)` → `createNewsClient(bearerToken)`
- MODIFIED: `app/api/news/macro/route.ts` — replaced 5-line inline `createClient(...)` → `createNewsClient(bearerToken)`
- MODIFIED: `app/api/news/portfolio/route.ts` — replaced 5-line inline `createClient(...)` → `createNewsClient(bearerToken)`
- MODIFIED: `app/api/news/refresh/route.ts` — replaced user-scoped Bearer client (line 44) → `createNewsClient(bearerToken)`; `SUPABASE_SERVICE_ROLE_KEY` service client (line 68) kept inline — `news_cache` has no per-user RLS for writes, service-role bypass is architecturally correct per B-6

**Note:** `refresh/route.ts` retains `import { createClient } from '@supabase/supabase-js'` for the service-role client only.

**Verification:** `tsc --noEmit` ✅ | `pnpm test lib/newsQueryService.test.ts` — 29 tests ✅ | `pnpm test app/api/news/` — 13 tests ✅ | `pnpm test` — 58 files, 573 tests ✅

---

## Phase 6 — Railway ↔ Next.js Contract Formalization ✅ NO-OP

**Status:** ✅ COMPLETED

**Completed:** 2026-04-01

**Pre-Check:** Verified `lib/types/simulation.ts` fields exactly match Railway `api/optimize.py` `run_optimization()` return value:

- `strategies.not_to_lose/expected/optimistic.weights` → `Record<string, number>` ✅
- `strategies.*.return_3m` → `string` ✅
- `strategies.*.range` → `string` ✅
- `metadata.is_truncated_below_3_years` → `boolean` ✅
- `metadata.limiting_ticker` → `string` ✅
- `metadata.lookback_months` → `number` ✅

**Additional verification:**

- `app/api/optimize/route.ts` — pure streaming passthrough, no caching, no transformation ✅
- Components (`SimulationResultsTable`, `StrategyCard`, `SiloDetailView`) import from `lib/types/simulation.ts` ✅
- `app/api/silos/[silo_id]/holdings/route.ts` — confirmed false positive (uses `computeDriftState` from `lib/drift`, not simulation types)

**Finding:** Phase 6 is a NO-OP — simulation types were already complete from Phase 1c.

**Verification:** `tsc --noEmit` ✅

---

## Phase 7 — SessionContext Split into AuthContext + UIContext

**Status:** ✅ COMPLETED

**Completed:** 2026-04-01

### Phase 7a — Scaffold UIContext + mount in providers ✅

**Completed:** 2026-04-01

**Changes:**

- NEW: `contexts/UIContext.tsx` — `UIContext` + `UIContextProvider` + `useUI()` + `useSiloCount()`
  - `useUI()`: exposes `showUSD`, `setShowUSD`, `onboarded`, `setOnboarded`, `progressBannerDismissed`, `setProgressBannerDismissed`
  - `useSiloCount()`: derived from `useQuery(['silos'])`; filters `is_active === true`; returns count
  - `UIContextProvider` syncs with persisted profile values via `onAuthStateChange`
- MODIFIED: `components/providers.tsx` — mounts `UIContextProvider` inside `SessionProvider`

**Note:** Per Phase 7a plan, ProgressBanner migration is deferred to Phase 7c — it currently reads `session` and `refreshProfile` from SessionContext (both auth state), not from UIContext. No change needed to ProgressBanner in Phase 7a.

**Verification:** `tsc --noEmit` ✅ | `pnpm test` — 58 files, 573 tests ✅

### Phase 7b — Component migrations (TopBar, OnboardingGate, OnboardingModal, overview page) ✅

**Completed:** 2026-04-01

**Changes:**

- NEW: `contexts/AuthContext.tsx` — auth state context (`session`, `user`, `profile`, `refreshProfile`, `isLoading`)
- MODIFIED: `components/providers.tsx` — mounts `AuthProvider` alongside existing providers (SessionProvider + UIContextProvider still present)
- MODIFIED: `components/layout/TopBar.tsx` — `session` from `useAuth()`; `showUSD`/`setShowUSD` from `useUI()`
- MODIFIED: `components/shared/OnboardingGate.tsx` — `isLoading` from `useAuth()`; `onboarded`/`progressBannerDismissed` from `useUI()`; `siloCount` via `useSiloCount()`
- MODIFIED: `components/shared/OnboardingModal.tsx` — `refreshProfile` from `useAuth()`; removed `setSiloCount` call (replaced with `refreshProfile()` only)
- MODIFIED: `app/(dashboard)/overview/page.tsx` — `session` from `useAuth()`; `showUSD` from `useUI()`
- UPDATED: `components/shared/OnboardingGate.test.tsx` — mocks updated to mock `AuthContext` + `UIContext` instead of `SessionContext`
- UPDATED: `components/shared/OnboardingModal.test.tsx` — mock updated to mock `AuthContext` instead of `SessionContext`

**Note:** `discover/page.tsx` and `news/page.tsx` only read `session` (not `showUSD`) from SessionContext — no changes needed.

**Verification:** `tsc --noEmit` ✅ | `pnpm test` — 58 files, 573 tests ✅

### Phase 7c — Narrow SessionContext + migrate ProgressBanner + Sidebar ✅

**Completed:** 2026-04-01

**Changes:**

- MODIFIED: `contexts/AuthContext.tsx` — added `useQueryClient` + `queryClient.invalidateQueries({ queryKey: ['silos'] })` to `refreshProfile()` so `useSiloCount()` and ProgressBanner both re-fetch after silo mutations
- MODIFIED: `components/shared/ProgressBanner.tsx` — migrated to `useAuth()` (was: `useSession()`) for `session` + `refreshProfile`; ProgressBanner already had its own `useQuery(['silos'])` so `useSiloCount()` is now reactive via the invalidation chain
- MODIFIED: `components/layout/Sidebar.tsx` — migrated to `useAuth()` (was: `useSession()`) for `profile` + `session`; `siloCount` derivation unchanged (from `useQuery(['profile'])`)
- MODIFIED: `components/shared/ProgressBanner.test.tsx` — updated mock from `SessionContext` to `AuthContext`
- NOTE: `SessionContext` retains full interface (auth + UI state) for backward compatibility with remaining call sites. `useAuth()` from AuthContext is the preferred import for new code.

**Architecture achieved:**

- `AuthContext` — auth state: `session`, `user`, `profile`, `refreshProfile` (with silos invalidation), `isLoading`
- `UIContext` — UI state: `showUSD`, `setShowUSD`, `onboarded`, `setOnboarded`, `progressBannerDismissed`, `setProgressBannerDismissed` + `useSiloCount()` hook
- `SessionContext` — kept as-is for backward compatibility (still mounted in providers, still works with existing call sites)
- Clean separation: auth state and UI state are now in separate contexts with clear responsibilities

**Verification:** `tsc --noEmit` ✅ | `pnpm test` — 58 files, 573 tests ✅

---

## Phase 7 — SessionContext Split into AuthContext + UIContext ✅ COMPLETE

**Completed:** 2026-04-01

All 3 sub-phases (7a, 7b, 7c) complete. SessionContext successfully split.

**Summary of Phase 7:**

| Sub-phase | What was done                                                                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 7a        | Created `UIContext` (`useUI()`, `useSiloCount()`) + mounted in providers                                                    |
| 7b        | Created `AuthContext`; migrated TopBar, OnboardingGate, OnboardingModal, overview page                                          |
| 7c        | Added `queryClient.invalidateQueries` to `AuthContext.refreshProfile()`; migrated ProgressBanner and Sidebar to `useAuth()` |

**Remaining note:** `SessionContext` still mounted in providers with full interface for backward compatibility. Components can migrate to `useAuth()` / `useUI()` at leisure — no urgency.
