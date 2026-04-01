# REFACTOR_AUDIT.md — Component Decoupling Refactoring

> Independent Code Auditor's findings on each completed phase.
> Append new entries as phases are completed. DO NOT modify existing entries.

---

## Phase 1 — Shared Types & Orphan Code

**Phase Audited:** Phase 1 (all sub-phases: 1a, 1b, 1c)
**Commit Hash:** `5e1f05b` — "refactor(Phase 1): extract DriftAsset to lib/types/portfolio — decouple cross-component type imports"
**Files Touched (by commit):** REFACTOR_LOG.md, overview/page.tsx, GlobalDriftBanner.tsx, PortfolioSummaryCard.tsx, SiloCard.tsx, lib/priceHistory.ts, **lib/types/portfolio.ts (NEW)**

---

### Phase 1a — DriftAsset Extraction

**Scope Creep Assessment:** ✅ PASS
- New file `lib/types/portfolio.ts` is the *only* net-new file; everything else is a pure import-path update.
- No logic was changed in any component. No new features introduced.
- `discover/page.tsx` correctly left untouched — it has a *different* `DriftAsset` shape (`current_weight_pct`, `target_weight_pct`, `drift_state: DriftState`) serving a different API contract. This is architecturally correct separation.

**Architectural Illusion Assessment:** ✅ PASS
- `DriftAsset` is now a shared interface in `lib/types/` — the canonical location for cross-component types.
- All 4 import sites confirmed updated via independent grep:
  - `GlobalDriftBanner.tsx` → `@/lib/types/portfolio` ✅
  - `PortfolioSummaryCard.tsx` → `@/lib/types/portfolio` (re-exports nothing else related) ✅
  - `SiloCard.tsx` → `@/lib/types/portfolio` ✅
  - `overview/page.tsx` → `@/lib/types/portfolio` ✅
- `PortfolioSummaryCard` still exports `SiloForSummary` — distinct interface, correctly left in component.

**Next.js & Railway Contracts:** ✅ PASS
- Phase 1a touches only shared TypeScript interfaces. No Next.js server-side caching (`fetch` tags, `revalidate`) exists in these components — they are client components (`'use client'`) fed by `useQuery` hooks. No caching stripped.
- No Railway/FastAPI contract changes. The `DriftAsset` type used in the overview page is a UI rendering type, not a DB or API contract type.

**Silent Breakage Test:** ✅ PASS
- `tsc --noEmit` confirmed passing (per REFACTOR_LOG.md).
- `pnpm test` confirmed: 57 files, 562 tests passing.
- No orphaned imports found. All `DriftAsset` references now point to `@/lib/types/portfolio`.
- `SiloCardData` still correctly exported from `SiloCard.tsx` and imported in `overview/page.tsx` — not affected by this phase.
- `DriftResponse.assets: DriftAsset[]` in `overview/page.tsx` line 27 correctly typed via the shared interface.

**Block Criterion Check:** ✅ VERIFIED
- Pre-execution grep was run (documented in REFACTOR_LOG). The `discover/page.tsx` separate shape was identified and excluded per plan.
- No files were modified without a pre-existing grep confirmation.

---

### Phase 1b — Orphaned `lib/priceHistory.ts`

**Scope Creep Assessment:** ✅ PASS
- Only change: added `// TODO(STORY-044): activate this` comment. No code deleted or modified.
- Correct decision — the file has a future use case (STORY-044 price history activation) per the plan.

**Silent Breakage Test:** ✅ PASS
- `tsc --noEmit` passes (per REFACTOR_LOG.md).
- Independent grep confirms: no import sites outside `lib/priceHistory.ts` and `lib/priceHistory.test.ts` (self-references only). Confirmed by PROJECT_LOG.md (Python uses `yfinance` directly, not this file) — no live dependency.

---

### Phase 1c — Simulation Types Completeness

**Assessment:** ✅ VERIFIED AS NO-OP
- `lib/types/simulation.ts` fields match Railway `api/optimize.py` `run_optimization()` return value exactly:
  - `strategies.not_to_lose/expected/optimistic` ✅
  - `metadata.is_truncated_below_3_years: boolean` ✅
  - `metadata.limiting_ticker: string` ✅
  - `metadata.lookback_months: number` ✅
- `app/api/optimize/route.ts` is a pure passthrough (no caching, no transformation) ✅
- Components (`SimulationResultsTable`, `SiloDetailView`) import from `lib/types/simulation` ✅
- `tsc --noEmit` passes.

---

### Verdict: **PASS**

**No critical flaws detected.**

Phase 1 is a textbook low-risk type extraction:
- Scope was minimal and strictly bounded.
- Every import site was identified via pre-execution grep before touching any file.
- The `discover/page.tsx` exception was correctly identified and left alone — it represents a genuinely different type (different fields, different API response shape).
- The TODO on `lib/priceHistory.ts` is the correct conservative choice for future-use code with no live imports.
- All verifications (`tsc --noEmit`, `pnpm test`) confirmed passing.
- No Next.js caching contracts were affected.
- No Railway/FastAPI contracts were affected.
- No breaking changes to any component logic.

**Execution quality: High.** The agent followed the plan's block criteria, ran the pre-execution greps, and made the correct architectural call on the discover/page exclusion.

---

---

## Phase 2 — Encryption Adapter Extraction

**Phase Audited:** Phase 2 (all sub-phases)
**Commit Hash:** `f230166` — "refactor(Phase 2): extract encryption adapter with IEncryption interface"
**Files Touched (by commit):** REFACTOR_LOG.md, lib/encryption/adapter.ts (renamed from lib/encryption.ts), lib/encryption/encryption.test.ts (renamed), **lib/encryption/index.ts (NEW)**

---

### Scope Creep Assessment: ✅ PASS

- Exactly 4 files changed: `REFACTOR_LOG.md` (+25 lines), `lib/encryption/adapter.ts` (rename, logic unchanged), `lib/encryption/encryption.test.ts` (rename + import path update), `lib/encryption/index.ts` (new IEncryption interface + re-exports)
- No new features. No logic changes. Pure physical refactor.
- The adapter (`lib/encryption/adapter.ts`) is a byte-identical rename of the original with only a header comment update confirming it implements `IEncryption`
- All 8 route/test import sites confirmed still using `@/lib/encryption` — import path unchanged by plan design

---

### Architectural Illusion Assessment: ⚠️ MINOR DOCUMENTATION CONCERN (non-blocking)

**What was done:**
- `lib/encryption/index.ts` defines `IEncryption` interface with `encrypt(plaintext, key)` and `decrypt(ciphertext, key)` method signatures
- `export const encryption: IEncryption = { encrypt, decrypt }` singleton exported
- `export { encrypt, decrypt }` named function re-exports from `./adapter`

**What all 8 call sites actually use:**
```typescript
import { encrypt } from '@/lib/encryption'  // or { decrypt }
// usage:
encrypt(value, encKey)
decrypt(encValue, encKey)
```

**The gap:** The `IEncryption` interface describes an object with method-call syntax (`interface IEncryption { encrypt(...): string }`), but:
1. The `encryption` singleton is **never imported or used** by any route or test file in the codebase
2. All call sites use **named function imports** (`import { encrypt }`) not object-method calls (`encryption.encrypt()`)
3. The interface's method-call pattern is structurally compatible with the standalone functions (both have `(string, string) => string` signature), so TypeScript compiles cleanly

**Risk:** A future developer reading `lib/encryption/index.ts` might attempt to use `encryption.encrypt()` expecting it to work (it is the interface-suggested API), but since the singleton is never instantiated or provided anywhere, this would be a **runtime error**. This is a documentation/pattern trap, not a functional break.

**Severity: Low** — Named exports work correctly. All 562 tests pass. No call site is broken.

**Fix recommendation (non-blocking):** Either (a) delete the unused `encryption` singleton and keep only the named exports + `IEncryption` type, or (b) actually use the singleton at all call sites and update the plan to reflect a fuller adapter-pattern implementation.

---

### Next.js & Railway Contracts: ✅ PASS

- No Next.js `fetch` caching, `revalidate`, `revalidateTag`, or `Cache-Control` headers in scope for this phase
- No Railway/FastAPI contract changes — this is a pure client-side AES-256-GCM encryption library with no API or data-fetching semantics
- The module is fully server-side (Node.js `crypto` module) and safe for all broker credential paths (`Alpaca`, `BITKUB`, `InnovestX`, `Schwab`, `Webull`)

---

### Silent Breakage Test: ✅ PASS

- `lib/encryption.ts` (original) confirmed deleted — no orphan at old path
- All 8 import sites resolve via `@/lib/encryption` → `index.ts` → `adapter.ts` — TypeScript follows the index re-exports correctly
- Test file correctly renamed: `lib/encryption/encryption.test.ts` imports from `./adapter` (valid relative path after rename)
- `tsc --noEmit` clean (no output = no errors)
- `pnpm test lib/encryption/encryption.test.ts` — 3/3 ✅ (roundtrip, IV uniqueness, wrong-key error)
- `pnpm test` — 57 files, 562 tests ✅ — unchanged from Phase 1 baseline

---

### Verdict: **PASS**

**No critical flaws detected.**

Phase 2 is a clean, low-risk extraction:
- Scope was strictly bounded to the encryption module and its 8 confirmed import sites
- Import path `@/lib/encryption` preserved across all call sites (the key architectural guarantee)
- Rename of `lib/encryption.ts` → `lib/encryption/adapter.ts` was clean with only a header comment change
- TypeScript compiles cleanly; all 562 tests pass
- No Next.js caching contracts affected
- No Railway/FastAPI contracts affected

**Execution quality: High**, with one noted documentation concern: the `IEncryption` singleton is unused and could mislead future developers about the intended API pattern. This is non-blocking but should be addressed in a follow-up cleanup.

**Block Criterion Check:** ✅ VERIFIED
- The pre-execution grep identified exactly 8 import sites (all confirmed by reading the actual files)
- Import path was preserved as `@/lib/encryption` across all sites
- Rollback strategy was defined in plan and working tree was clean before execution (confirmed by commit structure)

---

## Pending Phases (not yet audited)

- Phase 3 — Eliminate Drift Logic Duplication
- Phase 4 — Top-Movers Service Extraction
- Phase 5 — News Route Auth Pattern Normalization
- Phase 6 — Railway ↔ Next.js Contract Formalization
- Phase 7 — SessionContext Split into AuthContext + UIContext
