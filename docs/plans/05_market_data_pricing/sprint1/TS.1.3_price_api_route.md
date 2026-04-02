# TS.1.3 — Price API Route

## Task
Create GET /api/prices/[asset_id] route that exposes price service to frontend.

## Target
`app/api/prices/[asset_id]/route.ts`

## Inputs
- TS.1.1 outputs (priceService)

## Process
1. Create `app/api/prices/[asset_id]/route.ts`:
   - Validate JWT
   - Look up asset details from `assets` table
   - Call `fetchPrice(supabase, assetId, ticker, source, coingeckoId)`
   - Return price response
2. This route is consumed by frontend components needing individual price refreshes
3. Bulk pricing is handled within holdings/drift API routes (not individual calls)

## Outputs
- `app/api/prices/[asset_id]/route.ts`

## Verify
- Returns cached price when fresh
- Fetches from external when stale
- 404 for unknown asset_id

## Handoff
→ Sprint 2 (FX rates + top movers)
