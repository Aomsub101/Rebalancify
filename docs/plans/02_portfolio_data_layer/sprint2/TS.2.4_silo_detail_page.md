# TS.2.4 — Silo Detail Page

## Task
Build the SiloDetailPage with HoldingsTable, WeightsSumBar, CashBalanceRow, and AssetSearchModal.

## Target
`app/(dashboard)/silos/[silo_id]/page.tsx`

## Inputs
- TS.2.1-2.3 outputs (Holdings, Weights, Price APIs)
- `docs/architecture/04-component-tree.md` §2.4

## Process
1. Create `app/(dashboard)/silos/[silo_id]/page.tsx`:
   - Fetch: holdings, target-weights, drift data via TanStack Query
   - Sections:
     - **SiloHeader:** name, PlatformBadge, ExecutionModeTag, SyncButton (API silos), LastSyncedTimestamp
     - **SiloSummaryBar:** TotalValueDisplay, CashBalanceDisplay, WeightsSumBar + WeightsSumWarning
     - **HoldingsTable:** rows with TickerCell, QuantityCell (editable for manual), CurrentValueCell, CurrentWeightCell, TargetWeightCell (editable), DriftCell
     - **CashBalanceRow:** editable for manual silos
     - **AddAssetButton** → opens AssetSearchModal
     - **RebalanceButton** → navigates to `/silos/[id]/rebalance`
   - EmptyState when zero holdings
   - LoadingSkeleton during fetch
2. Create `components/silos/AssetSearchModal.tsx`:
   - TypeSelector (Stock/ETF | Crypto)
   - SearchInput (debounced 300ms)
   - SearchResultsList with ConfirmButton per result
   - Confirm → POST /api/silos/:id/asset-mappings + POST holdings

## Outputs
- `app/(dashboard)/silos/[silo_id]/page.tsx`
- `components/silos/HoldingsTable.tsx`
- `components/silos/SiloSummaryBar.tsx`
- `components/silos/AssetSearchModal.tsx`
- `components/silos/WeightsSumBar.tsx`

## Verify
- Holdings table displays all derived fields
- Inline editing works for manual silos
- AssetSearchModal searches and adds assets
- WeightsSumWarning appears when sum ≠ 100%

## Handoff
→ Sprint 3 (Drift + FX)
