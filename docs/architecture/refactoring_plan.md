# Rebalancify Component Decoupling — Refactoring Plan

> **Status:** Approved for implementation
> **Last Updated:** 2026-04-01
> **Drives:** PROGRESS.md — Refactoring Epic (to be created)

---

## 1. The Goal

Physically and logically separate Rebalancify's 10 components so that each can be understood, tested, deployed, and replaced independently — without any component silently breaking another. The refactoring preserves all current functionality and introduces zero new features; it only creates clean boundaries where tangled ones exist today.

The Railway FastAPI microservice (C10) remains a first-class, contract-bound service with a stable TypeScript/Python interface surfaced through the Next.js proxy, so the Python backend and TypeScript frontend can evolve independently without co-evolution requirements.

---

## 2. The Problems It Solves

Based on `DOCS/architecture/integration_map.md` §4 ("Known Bottlenecks & Tangles"):

| ID | Bottleneck | Severity | Category |
|----|-----------|----------|----------|
| **B-1** | `DriftAsset` type defined inside `PortfolioSummaryCard.tsx`, imported by `SiloCard.tsx` — moving one file silently breaks the other | High | Cross-component type import |
| **B-2** | Drift state classification (`computeDriftState`) implemented in `lib/drift.ts` **and** re-implemented inline in `cron/drift-digest/route.ts` — two sources of truth for the same logic | High | Logic duplication |
| **B-3** | `lib/encryption.ts` is a single failure hub imported by 5 routes across C1, C3, C4, C8 — changing the algorithm, key env var, or IV handling breaks all simultaneously | High | Shared lib coupling |
| **B-4** | `SimulationResultsTable` and `SimulateScenariosButton` are directly imported into `SiloDetailView` — child mutates parent state via `onApplyWeights` callback prop, inverting the dependency | High | UI component coupling |
| **B-5** | Top-movers logic (FMP + Finnhub + stale-cache-final) is written entirely inline in `GET /api/market/top-movers` — unlike `lib/priceService.ts`, it is not abstracted for reuse | Medium | Logic encapsulation |
| **B-6** | Four news routes bypass `lib/supabase/server.ts` and construct `@supabase/supabase-js` directly with a Bearer token — RLS-blind at the client-construction level; any route that forgets to validate the header silently operates without user identity | Medium | Auth pattern inconsistency |
| **B-7** | `lib/priceHistory.ts` (`fetchPriceHistory`) is imported by **no route** — dead code that will silently diverge if `lib/priceService.ts` is updated | Low | Orphaned lib |
| **B-8** | `SessionContext` exposes UI state (`showUSD`, `siloCount`, `onboarded`, `progressBannerDismissed`) alongside auth state — components reading `siloCount` trust it as eventually consistent but have no invalidation signal | Medium | Context scope inflation |

---

## 3. The Proposed Solution (Underlying Concepts)

### Pattern 1 — Shared Types Directory
All cross-component TypeScript types move to `lib/types/`. A type stays in its component directory only if it is never imported by another component. `DriftAsset` (B-1) is the primary target.

### Pattern 2 — Typed Interface for Encryption
`IEncryption` interface defined in `lib/encryption/index.ts`; implementation in `lib/encryption/adapter.ts`. All five route files import through the interface. Algorithm changes are isolated to one file; TypeScript surfaces every call site at compile time.

### Pattern 3 — Railway ↔ Next.js Contract via Shared TypeScript Interfaces
The Railway FastAPI service already has Pydantic request/response models. A TypeScript interface file in `lib/types/optimization.ts` mirrors the Pydantic response shape. Frontend components are typed against this interface; the proxy route passes Railway responses through verbatim. No coupling introduced — Railway is an opaque backend.

### Pattern 4 — Dedicated Type-Safe Service Libs
Each domain (brokers, prices, news, top-movers) gets a typed client lib in `lib/` that encapsulates: auth mechanism (cookie vs. bearer vs. service-role), base URL (Next.js route vs. Railway URL), and request/response types. Blast radius of any auth-pattern change is limited to one lib file.

### Pattern 5 — Context Split
`SessionContext` is split into `useAuth()` (session, user, profile — server-authenticated) and `useUI()` (showUSD, siloCount, onboarded, progressBannerDismissed — client-side UI state). The `siloCount` invalidation problem is solved by deriving it from a TanStack Query `useQuery('silos')` call rather than maintaining a parallel copy.

---

## 4. Step-by-Step Execution Plan

---

### Phase 1 — Shared Types & Orphan Code

#### Phase 1a — Move `DriftAsset` to shared types

**Pre-Execution Check:**
```
Run: grep -rn "DriftAsset" --include="*.ts" --include="*.tsx" .
Run: grep -rn "import.*DriftAsset" --include="*.ts" --include="*.tsx" .
```
- Inspect the output of both commands to identify every file that references `DriftAsset`.
- Build a complete list of all affected import sites before beginning.
- **Block criterion:** If the grep returns zero results, `DriftAsset` may already be in `lib/types/` — investigate before proceeding.

- New file: `lib/types/portfolio.ts`
- Extract `DriftAsset` interface (currently in `components/overview/PortfolioSummaryCard.tsx`):
  ```typescript
  export interface DriftAsset {
    asset_id: string;
    ticker: string;
    drift_pct: number;
    drift_state: 'green' | 'yellow' | 'red';
    drift_breached: boolean;
  }
  ```
- Update every identified import site to source from `lib/types/portfolio.ts`.
- *Touched: N files discovered by the grep above + 1 new lib file*

**Verification for Phase 1a:** `tsc --noEmit` passes; all files that previously imported `DriftAsset` still resolve without error.

---

#### Phase 1b — Resolve orphaned `lib/priceHistory.ts`

**Pre-Execution Check:**
```
Run: grep -rn "priceHistory" --include="*.ts" --include="*.tsx" .
Run: grep -rn "fetchPriceHistory" --include="*.ts" --include="*.tsx" .
```
- Inspect the output to determine whether `lib/priceHistory.ts` is imported anywhere.
- **Block criterion:** If the file is imported elsewhere in the codebase, do not delete it — treat it as a future-use stub and apply the TODO comment approach instead.

- If truly dead code: delete `lib/priceHistory.ts`, remove from repo
- If intended for future use: move to `lib/priceHistory.ts` with a `// TODO(STORY-XXX): activate this` comment linking to the relevant future story
- *Touched: 0–1 lib files*

**Verification for Phase 1b:** `tsc --noEmit` passes with no warnings about unused `priceHistory` imports.

---

#### Phase 1c — Verify `lib/types/simulation.ts` is complete

**Pre-Execution Check:**
```
Run: grep -rn "SimulationResult\|SimulationStrategy\|SimulationMetadata" --include="*.ts" --include="*.tsx" .
```
- Collect all files that reference simulation types. Cross-reference against `api/optimize.py` `run_optimization()` return value to identify any mismatched or missing fields.
- **Block criterion:** If any component or route references a simulation type field not present in `lib/types/simulation.ts`, add it before proceeding to Phase 6.

- Check that `SimulationResult`, `SimulationStrategy`, `SimulationMetadata` interfaces match the Railway Pydantic response shape exactly
- Add any missing fields to `lib/types/simulation.ts` (cross-reference `api/optimize.py`)
- *Touched: 1 existing lib file*

**Verification for Phase 1c:** `tsc --noEmit` passes; all simulation type references are satisfied by `lib/types/simulation.ts`.

**Verification for Phase 1 (all sub-phases):** `tsc --noEmit` passes; `SiloCard`, `GlobalDriftBanner`, `SimulationResultsTable` render without type errors.

---

### Phase 2 — Encryption Adapter Extraction

**Pre-Execution Check:**
```
Run: grep -rn "encryption" --include="*.ts" --include="*.tsx" app/api/ lib/
```
- Inspect the output to identify every file that imports `lib/encryption`.
- List all import sites confirmed by the grep — do not assume a fixed count.
- **Block criterion:** Before creating `lib/encryption/index.ts`, confirm the exact set of files that will need their import paths updated.

- Create `lib/encryption/index.ts`:
  ```typescript
  export interface IEncryption {
    encrypt(plaintext: string): Promise<string>;
    decrypt(ciphertext: string): Promise<string>;
  }
  ```
- Rename current `lib/encryption.ts` → `lib/encryption/adapter.ts`, ensure it implements `IEncryption`
- Create `lib/encryption/index.ts` that re-exports the adapter instance as a singleton
- Update all identified import sites to import from `lib/encryption/index.ts`
- Add Vitest unit test: `lib/encryption/encryption.test.ts`
  - Test that `encrypt(plaintext) !== plaintext`
  - Test that `decrypt(encrypt(plaintext)) === plaintext`
  - Test that wrong ciphertext raises/returns error
- *Touched: 2 new files + N existing route files discovered by grep*

**Verification for Phase 2:** `pnpm test lib/encryption/encryption.test.ts` passes; all routes still function (`pnpm test`).

**Rollback Strategy:**
- Ensure working tree is clean before beginning Phase 2. Commit or stash all outstanding changes.
- If verification fails, execute `git reset --hard HEAD` to discard all Phase 2 changes and return to the clean state.
- Verify: `git status` shows clean working tree; `git log --oneline -1` confirms original commit.

---

### Phase 3 — Eliminate Drift Logic Duplication

**Pre-Execution Check:**
```
Run: grep -n "drift_state\|computeDriftState\|drift_pct.*green\|drift_pct.*yellow\|drift_pct.*red" app/api/cron/drift-digest/route.ts
```
- Identify the exact line range of the inline green/yellow/red classification logic in `cron/drift-digest/route.ts`.
- **Block criterion:** If the inline classification logic is absent from the file (may have been fixed already), Phase 3 is a no-op — verify `lib/drift.ts` exports `computeDriftState` and skip to Phase 4.

- Replace inline classification with:
  ```typescript
  import { computeDriftState } from '@/lib/drift';
  // ...
  const driftState = computeDriftState(driftPct, threshold);
  ```
- Add Vitest unit test: `lib/drift/drift.test.ts`
  - Test `computeDriftState(5, 10) → 'green'`
  - Test `computeDriftState(10, 10) → 'yellow'`
  - Test `computeDriftState(15, 10) → 'red'`
- Snapshot test: fetch a known silo via cron endpoint → compare HTML email output before/after (must be byte-identical)
- *Touched: 1 route file + 1 new test file*

**Verification for Phase 3:** Snapshot test passes; `pnpm test lib/drift/drift.test.ts` passes.

---

### Phase 4 — Top-Movers Service Extraction

**Pre-Execution Check:**
```
Run: grep -n "FMP\|Finnhub\|fetchTopMovers\|top-movers\|TopMover" app/api/market/top-movers/route.ts
```
- Map every inline FMP fetch, Finnhub fallback, and stale-cache-final branch in the route handler.
- **Block criterion:** If the top-movers logic does not use FMP, Finnhub, or a stale-cache fallback, re-read the route file to confirm the actual data sources before extracting.

**Next.js Caching Note:**
- The current inline route has no explicit `fetch` cache tags. When extracting to `lib/topMoversService.ts`, do not introduce new caching directives. Document the intended `revalidate` TTL as a code comment (e.g., `// intended revalidate: 60s`) so future developers know the expected staleness window.
- The thin route wrapper (`GET /api/market/top-movers/route.ts`) must preserve the same response shape as before — no caching logic is being moved or changed, only the data-fetching implementation is being extracted.

- Create `lib/topMoversService.ts`:
  ```typescript
  export async function fetchTopMovers(type: 'stocks' | 'crypto'): Promise<TopMoverAsset[]>
  ```
  — containing the FMP primary fetch, Finnhub fallback, and stale-cache-final logic currently inline in the route
- Rewrite `GET /api/market/top-movers/route.ts` as a thin wrapper:
  ```typescript
  const result = await fetchTopMovers(type);
  return NextResponse.json(result);
  ```
- Add Vitest unit test: `lib/topMoversService.test.ts`
  - Mock FMP and Finnhub responses
  - Test that FMP failure falls back to Finnhub
  - Test that Finnhub failure returns stale cache
  - Test that all three return types are correctly shaped
- *Touched: 1 new lib file + 1 new test file + 1 route file*

**Verification for Phase 4:** `pnpm test lib/topMoversService.test.ts` passes; `GET /api/market/top-movers?type=stocks` returns the same response as before (integration smoke).

**Rollback Strategy:**
- Ensure working tree is clean before beginning Phase 4. Commit or stash all outstanding changes.
- If verification fails, execute `git reset --hard HEAD` to discard all Phase 4 changes.
- Verify: `git status` shows clean working tree.

---

### Phase 5 — News Route Auth Pattern Normalization

**Pre-Execution Check:**
```
Run: grep -rn "createClient\|createAnonymousClient\|@supabase/supabase-js" app/api/news/
```
- Identify all news route files that construct a Supabase client directly.
- **Block criterion:** If no route constructs a client directly (pattern may have already been normalized), skip Phase 5b and apply only the documentation comment in Phase 5a.

**Phase 5a — Document the Bearer-token workaround**

- Add a documentation comment block to `lib/supabase/server.ts`:
  ```typescript
  /**
   * NOTE: The news routes (/api/news/portfolio, /api/news/macro,
   * /api/news/articles/:id/state, /api/news/refresh) use a direct
   * @supabase/supabase-js client with Bearer-token auth instead of
   * createServerClient(). This is because TanStack Query useQuery calls
   * fire from client components with no cookie jar available server-side.
   * The bearer token is validated server-side in each route handler.
   * See B-6 in DOCS/architecture/integration_map.md.
   */
  ```

**Phase 5b — Create typed news query client**

- Extend `lib/newsQueryService.ts` with:
  ```typescript
  export function createNewsClient(bearerToken: string): SupabaseClient
  ```
  — encapsulates the direct `@supabase/supabase-js` construction with the Bearer header
- Update all route files identified by the Pre-Execution Check grep to use `createNewsClient(bearerToken)` instead of raw `createClient(...)` inline
- Add Vitest unit test: `lib/newsQueryService.test.ts`
  - Test that `createNewsClient(token)` returns a SupabaseClient
  - Test that the client's auth header is correctly set
- *Touched: N route files identified by grep + 1 existing lib file + 1 new test file*

**Verification for Phase 5:** `pnpm test lib/newsQueryService.test.ts` passes; news endpoints return 200 with RLS-filtered results when called with a valid Bearer token.

**Rollback Strategy:**
- Ensure working tree is clean before beginning Phase 5. Commit or stash all outstanding changes.
- If verification fails, execute `git reset --hard HEAD` to discard all Phase 5 changes.
- Verify: `git status` shows clean working tree.

---

### Phase 6 — Railway ↔ Next.js Contract Formalization

**Pre-Execution Check:**
```
Run: grep -rn "SimulationResult\|SimulationStrategy\|SimulationMetadata" lib/types/simulation.ts
Run: grep -rn "from.*api/optimize\|from.*simulation" --include="*.tsx" --include="*.ts" components/ app/api/
```
- Confirm the exact set of components and routes that import simulation types. This determines which files must be verified after the type sync.
- **Block criterion:** If `lib/types/simulation.ts` has zero import sites beyond itself, this phase may be premature — verify Phase 1c was completed first.

**Next.js Caching Note:**
- `app/api/optimize/route.ts` is a pure proxy that passes Railway responses through verbatim. It does **not** use Next.js `fetch` caching, `revalidateTag`, or `Cache-Control` headers — it is a streaming Response passthrough.
- No caching behavior is being moved or altered in this phase. The contract formalization is purely a TypeScript type-safety exercise.

- Cross-reference `api/optimize.py` `run_optimization()` return value (`strategies`, `metadata`) against `lib/types/simulation.ts`
- Add any missing fields to `lib/types/simulation.ts` (e.g., `lookback_months`, `limiting_ticker`, `is_truncation_below_3_years`)
- Confirm `components/simulation/SimulationResultsTable` and `components/simulation/StrategyCard` import from `lib/types/simulation.ts` — not from the API route
- Confirm `app/api/optimize/route.ts` proxy passes Railway response through verbatim (no transformation)
- Add Vitest unit test: `lib/types/simulation.test.ts`
  - Test that a full Railway response object satisfies the TypeScript interfaces
  - Test that the three strategy weights sum to approximately 1.0 (within floating-point tolerance)
- *Touched: 1 existing lib file + 1–N component files identified by grep + 1 new test file*

**Verification for Phase 6:** `tsc --noEmit` passes; end-to-end simulation flow (click Simulate Scenarios → view results → Apply Weights) works without type errors.

---

### Phase 7 — SessionContext Split into AuthContext + UIContext

> **Highest-risk phase.** Execute only after all other phases (1–6) are verified complete. This phase is further split into three sub-phases (7a → 7b → 7c) to enable incremental verification and safe rollback at each step.

**Pre-Execution Check:**
```
Run: grep -rn "SessionContext\|useSession\|sessionContext" --include="*.tsx" --include="*.ts" components/ contexts/ app/
```
- Collect the full list of files that import or reference `SessionContext`. These are all the files that will need import path updates.
- **Block criterion:** Do not begin Phase 7a until Phases 1–6 all pass verification. If any prior phase has unverified failures, Phase 7 will magnify them.

---

#### Phase 7a — Scaffold new contexts + migrate `ProgressBanner.tsx` (non-critical UI-only component)

**Rationale:** `ProgressBanner.tsx` reads only `progressBannerDismissed` — a UI flag with no downstream state dependencies. It is the safest component to migrate first as a pilot.

- Create `contexts/UIContext.tsx`:
  ```typescript
  interface UIState {
    showUSD: boolean;
    onboarded: boolean;
    progressBannerDismissed: boolean;
  }
  ```
- `siloCount` is derived in a later sub-phase (7c) when the TanStack Query `useQuery('silos')` hook is available.
- `UIContext` at this stage exposes: `showUSD`, `setShowUSD`, `onboarded`, `setOnboarded`, `progressBannerDismissed`, `setProgressBannerDismissed`
- `DirtyStateContext` remains unchanged (already separate)
- Update `ProgressBanner.tsx` to import from `UIContext` (was: `SessionContext`)
- Update `AppShell` layout to mount `UIContext` alongside existing `SessionContext`

**Verification for Phase 7a:** `tsc --noEmit` passes; `ProgressBanner.tsx` renders correctly; `pnpm test` passes.

**Rollback for Phase 7a (if verification fails):**
- Ensure working tree is clean before beginning Phase 7. Commit or stash all outstanding changes.
- If verification fails, execute `git reset --hard HEAD` to discard all Phase 7a changes.
- Verify: `git status` shows clean working tree.

**Block for Phase 7b:** Phase 7a verification must pass before proceeding to 7b.

---

#### Phase 7b — Migrate `Sidebar.tsx` (reads both auth + UI state)

**Rationale:** `Sidebar.tsx` is the most coupled component — it reads `siloCount` (UI) and `profile` (auth). Migrating it second validates that the two contexts can coexist in a deeply coupled component.

- Extract `siloCount` from `UIContext` to be derived from `useQuery(['silos'])` within `Sidebar.tsx`:
  ```typescript
  const { data: silos } = useQuery({ queryKey: ['silos'], ... });
  const siloCount = silos?.length ?? 0;
  ```
- Update `Sidebar.tsx` to import `siloCount`-derived value from `UIContext` (not `SessionContext`)
- Update `Sidebar.tsx` to import `profile` from `AuthContext` (the narrowed `SessionContext`)
- `UIContext` now exposes `siloCount` (read-only, derived) in addition to its previous surface
- Update `AppShell` to mount both providers (already done in 7a)

**Verification for Phase 7b:** `tsc --noEmit` passes; `Sidebar.tsx` displays correct `siloCount` without page reload; `pnpm test` passes.

**Rollback for Phase 7b (if verification fails):**
- Execute `git reset --hard HEAD` to discard all Phase 7b changes (this reverts `Sidebar.tsx` and the derived `siloCount` addition to `UIContext`).
- Verify Phase 7a still passes before re-attempting 7b.
- Verify: `git status` shows only Phase 7a changes remain.

**Block for Phase 7c:** Phase 7b verification must pass before proceeding to 7c.

---

#### Phase 7c — Migrate remaining components

**Pre-Execution Check (for remaining components):**
```
Run: grep -rn "SessionContext" --include="*.tsx" --include="*.ts" components/ app/
```
- Compare against the full list from the Phase 7 Pre-Execution Check. The delta (files not yet updated) are the targets for Phase 7c.
- **Block criterion:** If the delta is empty, Phase 7c is complete — skip to final verification.

- Migrate remaining components, one at a time in this order:
  1. `TopBar.tsx` — reads `showUSD` (UIContext)
  2. `OverviewPage.tsx` — reads `showUSD` (UIContext)
  3. `OnboardingGate.tsx` — reads `onboarded`, `siloCount` (UIContext)
  4. `OnboardingModal.tsx` — reads `siloCount` (UIContext), calls `refreshProfile()` (AuthContext)
  5. `SiloCard.tsx` — reads `showUSD` (UIContext via props from OverviewPage)
  6. `app/(auth)/layout.tsx` — mounts only `AuthContext`
- `useSimulationConstraints` hook — no changes (pure compute, no context)
- Narrow `SessionContext` to auth state: retains only `session`, `user`, `profile`, `refreshProfile`, `isLoading`
- Rename to `AuthContext` in code; keep `SessionContext` as the exported alias for minimal diff

**Verification for Phase 7c:** `tsc --noEmit` passes; all migrated components render without error; `pnpm test` passes.

**Rollback Strategy for Phase 7 (overall):**
- Ensure working tree is clean before beginning Phase 7. Commit all prior phases (1–6) to a named branch or ref.
- If Phase 7c final verification fails, execute `git reset --hard HEAD` to discard all Phase 7 changes.
- Verify: `git status` shows clean working tree with all Phase 1–6 changes intact.

---

**Verification for Phase 7 (all sub-phases):** `pnpm test` passes; manual smoke test: create silo, verify `siloCount` increments in sidebar without page reload; toggle `showUSD`, verify prices update.

---

## 5. New Test Files Added

| Test File | What It Tests |
|-----------|--------------|
| `lib/encryption/encryption.test.ts` | encrypt/decrypt roundtrip, error on invalid ciphertext |
| `lib/drift/drift.test.ts` | `computeDriftState` threshold boundaries |
| `lib/topMoversService.test.ts` | FMP→Finnhub→stale-cache fallback chain |
| `lib/newsQueryService.test.ts` | Bearer-token client construction |
| `lib/types/simulation.test.ts` | Railway response satisfies TypeScript interfaces |
| `contexts/UIContext.test.tsx` | UI state defaults, `siloCount` derivation |
| `contexts/SessionContext.test.tsx` | Auth refresh, unauthenticated state |

---

## 6. Execution Order & Dependencies

```
Phase 1a (types)    → before anything else (foundational)
Phase 1b (orphan)   → after 1a (independent)
Phase 1c (sim types) → after 1a (uses lib/types/portfolio.ts)

Phase 2 (encryption)  → independent of Phases 1a–1c
Phase 3 (drift dup)  → independent of all
Phase 4 (top-movers) → independent of all

Phase 5 (news auth)  → after Phase 1a (lib/types/ available)

Phase 6 (Railway contract) → after Phase 1c (lib/types/simulation.ts must be complete)

Phase 7 (SessionContext) → AFTER all other phases; highest risk
  Phase 7a (scaffold + ProgressBanner) → verify before 7b
  Phase 7b (Sidebar)                   → verify before 7c
  Phase 7c (remaining components)       → final verification
  → Verify all prior phases pass before starting Phase 7
```

**Summary count:** 7 phases (7a–7c for Phase 7), ~13 new files (libs + tests), N existing files modified (determined dynamically per phase by grep).

---

## 7. What Is NOT In Scope

- No source code rewrites beyond import path changes and thin wrapper extraction
- No changes to the optimization math functions (`min_variance_portfolio`, `max_sharpe_portfolio`, `target_risk_portfolio`, `project_3m`, `fetch_prices`, `calculate_annualized_metrics`, `truncate_to_common_length`) — these are explicitly out of scope per `api/optimize.py` header comment
- No database migrations or schema changes
- No new API endpoints
- No visual/UI changes
- No changes to `app/api/optimize/route.ts` proxy logic (Railway stays as-is per decision)
- No changes to broker SDKs or their call signatures
- No Vercel Services migration (Railway is the deployment target for C10)
