# Component 7 — Asset Discovery

## 1. The Goal

Provide a market exploration surface for assets not yet in the user's portfolio — peer assets per ticker (who else looks like this company), a Top Gainers/Losers dashboard for US stocks and crypto, and a drift mini-summary of the user's existing portfolio. The Discover page is the primary entry point for research queries, linking directly into the AI Research Hub when the user taps a ticker.

---

## 2. The Problem It Solves

Investors researching a potential addition to their portfolio need context: who are its peers? How has it performed recently? And how does it fit into their existing allocation? Without a discovery surface, users would need to leave Rebalancify to answer these questions — breaking the decision-support loop. The Discover page keeps users inside Rebalancify while providing the market context needed for informed decisions.

---

## 3. The Proposed Solution / Underlying Concept

### Peer Assets (STORY-024)

`GET /api/assets/:id/peers` returns 5–8 peer assets for a given ticker:

1. **Primary source**: Finnhub `/stock/peers` — returns a list of related tickers Finnhub considers peers
2. **Fallback**: `sector_taxonomy.json` — a static file distributed with the application containing 50+ major stocks across 8 sectors (Technology, Financials, Healthcare, Consumer, Energy, Industrials, Utilities, Real Estate). When Finnhub is unavailable, peers are resolved from the static taxonomy using sector membership.

Each peer in the response includes: `ticker`, `name`, `current_price` (from `price_cache`).

### Top Gainers/Losers (STORY-025)

`GET /api/market/top-movers?type=stocks` — US stocks via Finnhub or FMP
`GET /api/market/top-movers?type=crypto` — crypto via CoinGecko (no API key required)

Returns top 5 gainers + top 5 losers, each with: `ticker`, `name`, `current_price`, `daily_change_pct`.

**Stale-cache fallback**: If the external source is unavailable, the endpoint returns the last cached data with a `stale: true` flag. No error is shown to the user — the page continues to function with whatever data is available.

**Non-colour signals**: Gainers are shown with a green background + `TrendingUp` icon; losers with a red background + `TrendingDown` icon. Colour-blind users receive the same information through the icon and directional label.

### Discover Page UI (STORY-026)

The Discover page has three primary sections:

**`TopMoversTabs`**: Two tabs — "US Stocks" and "Crypto". Each renders a `TopMoversTable` with gainers and losers. Loading states use `LoadingSkeleton`. If no data is available (all sources failed), `EmptyState` is shown.

**`AssetPeerSearch`**: A debounced search input (calls `GET /api/assets/search`) that returns ranked results from Finnhub (stocks) or CoinGecko (crypto). Selecting an asset calls `GET /api/assets/:id/peers` and renders a `PeerCard` grid.

**`PeerCard`**: Shows `ticker`, `name`, `current_price`. No `AiInsightTag` in v1.0 — that is added in STORY-033 (Component 8).

**`PortfolioDriftSummary`**: A sidebar or section showing one `DriftSiloBlock` per silo, with each asset's `DriftBadge` visible. This is driven by `GET /api/silos/:id/drift` for each silo. It gives the user immediate context about how their existing portfolio is doing before they start exploring new assets.

### Discover Page Layout

```
/discover
├── TopMoversTabs
│   ├── [US Stocks] → TopMoversTable (gainers + losers)
│   └── [Crypto] → TopMoversTable (gainers + losers)
├── AssetPeerSearch → PeerCard grid (after asset selection)
└── PortfolioDriftSummary → DriftSiloBlock × N
```

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Peer endpoint — Finnhub hit | Unit: call `GET /api/assets/:id/peers` with Finnhub available → Finnhub called, response returned |
| Peer endpoint — Finnhub miss → static fallback | Unit: mock Finnhub failure → static `sector_taxonomy.json` returned, no error UI |
| Top movers — source unavailability | Unit: mock Finnhub/FMP failure → cached data returned with `stale: true` |
| Top movers — colour + icon | Manual: verify gainer rows have green bg + `TrendingUp` icon; loser rows have red bg + `TrendingDown` icon |
| Discover page — three sections | Manual: `/discover` renders TopMoversTabs, AssetPeerSearch, PortfolioDriftSummary |
| AiInsightTag absent in v1.0 | `grep -rn "AiInsightTag" components/` → zero results in v1.0 |
| LoadingSkeleton on all sections | Manual: throttle network → each section shows skeleton during load |
| EmptyState when no data | Manual: block all external sources → `EmptyState` shown for TopMovers |

---

## 5. Integration

### API Routes

| Method + Path | What It Does |
|---|---|
| `GET /api/assets/search?q=&type=` | Finnhub (stocks) or CoinGecko (crypto) search |
| `GET /api/assets/:id/peers` | Finnhub peers with static fallback |
| `GET /api/market/top-movers?type=` | Top 5 gainers + 5 losers (stocks or crypto) |

### Feeds Into

| Component | How |
|---|---|
| **Component 8 — AI Research Hub** | Ticker selection on Discover page triggers `/research/[ticker]` navigation |
| **Component 1 — Auth & Foundation** | Discover page is a nav destination in AppShell sidebar |

### Consumed From

| Component | What It Provides |
|---|---|
| **Component 2 — Portfolio Data Layer** | `GET /api/silos/:id/drift` for `PortfolioDriftSummary`; silo list for drift mini-summary |
| **Component 5 — Market Data** | `priceService.ts` for `PeerCard` price display and Top Movers pricing |

### UI Components

| Component | Where Used |
|---|---|
| `components/discover/TopMoversTabs.tsx` | Discover page |
| `components/discover/TopMoversTable.tsx` | TopMoversTabs |
| `components/discover/AssetPeerSearch.tsx` | Discover page |
| `components/discover/PeerCard.tsx` | After asset selection (v1.0: no AiInsightTag) |
| `components/discover/PortfolioDriftSummary.tsx` | Discover page |
| `components/discover/DriftSiloBlock.tsx` | PortfolioDriftSummary |
| `components/shared/LoadingSkeleton.tsx` | All data-fetching sections |
| `components/shared/EmptyState.tsx` | TopMovers when no data |
| `components/shared/DriftBadge.tsx` | DriftSiloBlock (from Component 2) |

### External Data Sources

| Source | Used For |
|---|---|
| Finnhub `/stock/peers` | Peer discovery |
| Finnhub `/quote` | US stock prices in Top Movers |
| `sector_taxonomy.json` | Peer fallback |
| CoinGecko `/simple/price` | Crypto prices in Top Movers |
