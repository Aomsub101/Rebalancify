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
**Status:** Pending
**Completed:** 2026-04-01

**Pre-Check:** `grep -n "drift_state\|computeDriftState\|drift_pct.*green\|drift_pct.*yellow\|drift_pct.*red" app/api/cron/drift-digest/route.ts` — no matches

**Finding:** `cron/drift-digest/route.ts` uses a binary breach check (`drift > silo.drift_threshold`) — it never implemented green/yellow/red classification because its purpose is breach detection for email digest, not three-state UI classification. `computeDriftState` lives correctly in `lib/drift.ts` and is used by `holdings/route.ts` and `drift/route.ts`. The duplication noted in B-2 never existed in this form.

**Verification:** `tsc --noEmit` ✅ | `pnpm test lib/drift.test.ts` — 9 tests ✅

---

## Phase 4 — Top-Movers Service Extraction
**Status:** Pending

---

## Phase 5 — News Route Auth Pattern Normalization
**Status:** Pending

---

## Phase 6 — Railway ↔ Next.js Contract Formalization
**Status:** Pending

---

## Phase 7 — SessionContext Split into AuthContext + UIContext
**Status:** Pending
