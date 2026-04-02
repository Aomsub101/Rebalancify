# TS.2.3 — Peer Search UI

## Task
Build AssetPeerSearch input and PeerCard grid for peer discovery.

## Target
`components/discover/`

## Inputs
- `docs/architecture/components/07_asset_discovery/03_asset_peer_search.md`
- `docs/architecture/components/07_asset_discovery/04_peer_card.md`

## Process
1. Create `components/discover/AssetPeerSearch.tsx`:
   - Debounced search input (300ms) → calls GET /api/assets/search
   - Search results dropdown: ranked results from Finnhub/CoinGecko
   - Selecting an asset → calls GET /api/assets/:id/peers → renders PeerCard grid
2. Create `components/discover/PeerCard.tsx`:
   - Display: ticker, name, current_price (from price_cache)
   - No AiInsightTag in v1.0 (added in Component 08)
   - Clickable → navigates to `/research/[ticker]` (links to AI Research Hub)
3. PeerResultsGrid: responsive grid layout (2 cols mobile, 4 cols desktop)

## Outputs
- `components/discover/AssetPeerSearch.tsx`
- `components/discover/PeerCard.tsx`

## Verify
- Search returns results after 300ms debounce
- Selecting asset shows 5-8 peer cards
- PeerCard displays ticker, name, price
- No AiInsightTag in v1.0

## Handoff
→ TS.2.4 (Drift summary)
