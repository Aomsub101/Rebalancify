# TS.1.1 — Peers API

## Task
Implement GET /api/assets/:id/peers with Finnhub primary source and static sector_taxonomy fallback.

## Target
`app/api/assets/[id]/peers/route.ts`

## Inputs
- `docs/architecture/components/07_asset_discovery/07_api_assets_peers.md`
- Component 05 outputs (priceService, sector_taxonomy)

## Process
1. Create `app/api/assets/[id]/peers/route.ts`:
   - Look up asset from `assets` table → get ticker, sector
   - **Primary:** Finnhub `GET /stock/peers?symbol={ticker}` → list of peer tickers
   - **Fallback:** If Finnhub unavailable → `sector_taxonomy.json` lookup by sector
   - For each peer ticker: look up in `assets` table, fetch price from `price_cache`
   - Return 5-8 peers: `{ ticker, name, current_price }`
2. No `AiInsightTag` in v1.0 — added in Component 08 (STORY-033)
3. Error: Finnhub unavailable → static fallback (no error to user)

## Outputs
- `app/api/assets/[id]/peers/route.ts`

## Verify
- Finnhub available → Finnhub peers returned
- Finnhub unavailable → static taxonomy peers returned
- Each peer includes current_price from cache
- 5-8 peers returned

## Handoff
→ TS.1.2 (Top movers integration)
