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

## Phase 2 — Encryption Adapter Extraction
**Status:** Pending

---

## Phase 3 — Eliminate Drift Logic Duplication
**Status:** Pending

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
