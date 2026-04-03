# Plan Progress

This document tracks the refactor work completed against the existing implementation for:

- `01_auth_foundation`
- `02_portfolio_data_layer`
- `03_rebalancing_engine`

The guiding rule for every change was:

- reuse the existing working implementation first
- extract boundaries around the current code instead of rebuilding features from zero
- keep API contracts and user-visible behavior unchanged
- verify with targeted tests and `npx tsc --noEmit`

---

## 01_auth_foundation

### Completed refactor slices

#### Sprint 4

- `TS.4.1_session_context`
  - Reduced `SessionContext` to a compatibility layer over canonical auth state instead of maintaining a parallel auth/profile flow.
  - Moved silo-count reads to reactive query-derived state where applicable.

- `TS.4.2_profile_api`
  - Extracted `/api/profile` route logic into shared server-side helpers.
  - Extracted shared client-side `/api/profile` fetch/update helpers so layout and settings surfaces use the same query contract.

### Files changed

- `app/api/profile/route.ts`
- `lib/profileApi.ts`
- `lib/profileClient.ts`
- `lib/__tests__/profileApi.test.ts`
- `contexts/SessionContext.tsx`
- `components/providers.tsx`
- `components/layout/TopBar.tsx`
- `components/layout/Sidebar.tsx`
- `app/(dashboard)/discover/page.tsx`
- `app/(dashboard)/news/page.tsx`
- `app/(dashboard)/settings/page.tsx`
- `components/layout/BottomTabBar.tsx`

### Notes

- `TopBar`, `Sidebar`, `Discover`, and `Settings` now share the same `PROFILE_QUERY_KEY` and `/api/profile` client helpers.
- The USD toggle persistence behavior did not change; it was moved behind the shared profile client helper.
- Existing auth/profile behavior was preserved and verified rather than reimplemented.

---

## 02_portfolio_data_layer

### Completed refactor slices

#### Sprint 1

- `TS.1.1_silo_crud_api`
  - Extracted silo route behavior into a dedicated API helper module.

#### Sprint 2

- `TS.2.1_holdings_api`
  - Extracted holdings route behavior into a dedicated API helper module.

#### Sprint 4

- `TS.4.1_overview_page`
  - Moved overview-page fetch/orchestration logic into a dedicated client hook.
  - Moved FX/drift aggregation into pure helper functions with direct unit coverage.

### Files changed

- `app/api/silos/route.ts`
- `lib/siloApi.ts`
- `app/api/silos/[silo_id]/holdings/route.ts`
- `lib/holdingsApi.ts`
- `app/(dashboard)/overview/page.tsx`
- `hooks/useOverviewData.ts`
- `lib/overview.ts`
- `lib/__tests__/overview.test.ts`

### Notes

- The existing `/api/silos` and holdings behavior remained the source of truth; the refactor only thinned the route handlers.
- The overview page still renders the same summary card, drift banner, and silo cards, but data fetching and derivation now live outside the page component.

---

## 03_rebalancing_engine

### Completed refactor slices

#### Sprint 2

- `TS.2.1_rebalance_engine`
  - Preserved the existing pure engine in `lib/rebalanceEngine.ts` as the calculation core.

- `TS.2.2_calculate_route`
  - Extracted calculate-route logic into a dedicated server helper.
  - Added route-level tests around calculate behavior.

#### Sprint 3

- `TS.3.1_execute_route`
  - Extracted execute-route logic into a dedicated server helper.

#### Sprint 4

- `TS.4.1_wizard_orchestrator`
  - Preserved the current wizard orchestration and reduced panel-level API ownership.

- `TS.4.2_config_panel`
  - Moved calculate request logic into a shared rebalance client helper.

- `TS.4.3_order_review_panel`
  - Moved execute request logic and shared order-derivation helpers out of the panel component.

- `TS.4.4_execution_result_panel`
  - Moved platform-label/manual-instruction logic into shared UI helpers.

### Files changed

- `app/api/silos/[silo_id]/rebalance/calculate/route.ts`
- `lib/rebalanceCalculateApi.ts`
- `app/api/silos/[silo_id]/rebalance/calculate/__tests__/route.test.ts`
- `app/api/silos/[silo_id]/rebalance/execute/route.ts`
- `lib/rebalanceExecuteApi.ts`
- `components/rebalance/RebalanceConfigPanel.tsx`
- `components/rebalance/OrderReviewPanel.tsx`
- `components/rebalance/ExecutionResultPanel.tsx`
- `lib/rebalanceClient.ts`
- `lib/rebalanceUi.ts`
- `lib/__tests__/rebalanceUi.test.ts`

### Notes

- The calculate and execute routes now act as thin HTTP wrappers around extracted business-logic helpers.
- The wizard UI still follows the same 3-step flow and uses the same API contracts; the panel components now delegate API calls and shared formatting/mapping logic to reusable modules.

---

## Verification Run

The following verification was run after the refactor work:

```bash
npx vitest run lib/__tests__/profileApi.test.ts lib/__tests__/overview.test.ts lib/__tests__/rebalanceUi.test.ts app/api/profile/__tests__/route.test.ts app/api/silos/__tests__/route.test.ts app/api/silos/[silo_id]/holdings/__tests__/route.test.ts app/api/silos/[silo_id]/rebalance/calculate/__tests__/route.test.ts app/api/silos/[silo_id]/rebalance/execute/__tests__/route.test.ts lib/rebalanceEngine.test.ts
npx tsc --noEmit
```

Result:

- `63` tests passed
- `npx tsc --noEmit` passed

---

## Unrelated Files Left Untouched

These files were not part of the refactor implementation and were intentionally not modified:

- `docs/FEATURES_v1.3.txt`
- `docs/architecture/refactoring_plan.md`
