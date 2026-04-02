# TS.4.1 — Overview Page

## Task
Build the Overview page with PortfolioSummaryCard, SiloCardList, GlobalDriftBanner.

## Target
`app/(dashboard)/overview/page.tsx`

## Inputs
- Sprint 1-3 outputs (silos, holdings, drift, FX)
- `docs/architecture/04-component-tree.md` §2.2
- `docs/architecture/components/02_portfolio_data_layer/10-overview_page.md`

## Process
1. Create `app/(dashboard)/overview/page.tsx`:
   - Fetch: `GET /api/silos`, `GET /api/fx-rates`
   - For each silo: fetch drift summary
   - Sections:
     - **PortfolioSummaryCard:** total value across all silos (USD if toggle on), active silo count X/5, total unique assets
     - **GlobalDriftBanner:** conditional — rendered only if any silo has a drift-breached asset. Shows red DriftBadge per breached asset.
     - **SiloCardList:** grid of SiloCards, each with drift summary + AlpacaLiveBadge
     - **TopMoversWidget:** preview linking to `/discover` (placeholder for Component 07)
   - EmptyState when zero silos (CTA: "Create your first silo")
   - LoadingSkeleton during fetch
2. PortfolioSummaryCard aggregation:
   - Sum all silo total values (converted to USD if toggle on)
   - Count active silos
   - Count unique assets across all silos

## Outputs
- `app/(dashboard)/overview/page.tsx`
- `components/overview/PortfolioSummaryCard.tsx`
- `components/overview/GlobalDriftBanner.tsx`

## Verify
- Aggregation math correct across multiple silos
- GlobalDriftBanner appears only when drift breached
- USD conversion works in summary card

## Handoff
→ TS.4.2 (SiloCard component)
