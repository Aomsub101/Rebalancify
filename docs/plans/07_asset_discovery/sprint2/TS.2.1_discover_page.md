# TS.2.1 — Discover Page

## Task
Build the Discover page layout with three primary sections.

## Target
`app/(dashboard)/discover/page.tsx`

## Inputs
- Sprint 1 outputs (peers + top movers APIs)
- `docs/architecture/04-component-tree.md` §2.8
- `docs/architecture/components/07_asset_discovery/as_built_prd.md`

## Process
1. Create `app/(dashboard)/discover/page.tsx`:
   - **Section 1: TopMoversTabs** — tabs for "US Stocks" and "Crypto"
   - **Section 2: AssetPeerSearch** — search input + peer results grid
   - **Section 3: PortfolioDriftSummary** — per-silo drift mini-summary
   - LoadingSkeleton for each section independently
   - Responsive layout: stacked on mobile, side-by-side on desktop
2. Data fetching per section (independent useQuery calls):
   - Top movers: `useTopMovers(activeTab)`
   - Peers: `usePeers(selectedAssetId)` (triggered after search)
   - Drift: `useDriftSummary()` (all silos)

## Outputs
- `app/(dashboard)/discover/page.tsx`

## Verify
- All three sections render
- Each section loads independently (no blocking)
- LoadingSkeleton per section during load

## Handoff
→ TS.2.2 (Top movers UI)
