# TS.1.3 — BITKUB Price Cache Update

## Task
Populate price_cache from BITKUB ticker data during sync.

## Target
`lib/bitkubClient.ts` (price extraction)

## Inputs
- TS.1.2 outputs (BITKUB sync fetches ticker data)
- `docs/architecture/components/05_market_data_pricing/01-price_service.md`

## Process
1. During BITKUB sync, the public ticker response includes prices for all pairs
2. Extract price per held asset from ticker map
3. Upsert into `price_cache` with `source: 'bitkub'`
4. This provides Tier 1b pricing (BITKUB silos, 15-min TTL via price_cache_fresh)
5. CoinGecko remains the fallback for BITKUB assets if ticker API fails

## Outputs
- Price cache population logic in BITKUB sync flow

## Verify
- After BITKUB sync, price_cache has entries for all held assets
- Source = 'bitkub' on these entries
- price_cache_fresh view correctly reports freshness

## Handoff
→ Sprint 2 (InnovestX)
