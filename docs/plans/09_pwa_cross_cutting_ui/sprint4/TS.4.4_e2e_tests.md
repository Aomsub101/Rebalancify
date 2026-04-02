# TS.4.4 — E2E Tests

## Task
Write Playwright E2E tests for PWA, offline, onboarding, and progress features.

## Target
`tests/e2e/pwa.spec.ts`

## Process
1. `tests/e2e/pwa.spec.ts`:
   - **PWA installable:** Manifest valid, install prompt available
   - **Service worker:** Registered in Application panel
   - **Offline cached data:** Toggle offline → page loads with cached data
   - **Offline buttons disabled:** Sync/Refresh/Rebalance show disabled tooltip
   - **Onboarding modal:** New user → modal appears → non-dismissible (ESC + backdrop)
   - **Onboarding create silo:** Select platform → create → navigates to silo detail
   - **Onboarding skip:** Click "Skip" → modal gone → not shown on refresh
   - **Progress banner:** After onboarding → banner shows 3 steps
   - **Progress reactive:** Add holdings → step 1 fills in
   - **Progress dismiss:** Click X → banner gone on refresh (server-side persist)
   - **DIME badge:** Create DIME silo → PlatformBadge shows "DIME" not "MANUAL"
   - **Footer disclaimer:** Every page has "not financial advice" text
   - **LoadingSkeleton:** Throttle → skeletons on all data pages
   - **EmptyState:** Empty lists → EmptyState with CTA

## Outputs
- `tests/e2e/pwa.spec.ts`

## Verify
- `pnpm test:e2e -- pwa.spec.ts` passes all tests

## Handoff
→ Component 09 complete
