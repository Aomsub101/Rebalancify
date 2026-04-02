# TS.1.2 — Top Movers API Integration

## Task
Integrate the top movers endpoint (from Component 05) with the Discover page data layer.

## Target
Integration between `app/api/market/top-movers/route.ts` and Discover UI

## Inputs
- Component 05 TS.2.2 outputs (top-movers route)
- `docs/architecture/components/07_asset_discovery/08_api_market_top_movers.md`

## Process
1. Verify top-movers endpoint returns correct response shape for UI consumption
2. Create TanStack Query hooks:
   - `useTopMovers(type: 'stocks' | 'crypto')` → `useQuery(['top-movers', type])`
   - Refetch on tab switch, cache for 5 minutes client-side
3. Handle stale data: when `response.stale === true`, show StalenessTag on UI
4. Handle empty response: show EmptyState component

## Outputs
- `hooks/useTopMovers.ts`

## Verify
- Stocks tab shows correct gainers/losers
- Crypto tab shows correct gainers/losers
- Stale flag → StalenessTag visible
- Empty state when no data

## Handoff
→ Sprint 2 (Discover page UI)
