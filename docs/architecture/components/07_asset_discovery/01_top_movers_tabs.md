# Sub-Component: Top Movers Tabs

## 1. The Goal

Provide a tabbed interface switching between US Stocks and Crypto top movers data on the Discover page, allowing investors to quickly scan market performance in both asset classes without leaving Rebalancify.

---

## 2. The Problem It Solves

Users exploring new assets need to see recent market momentum — which stocks and crypto are gaining or losing. Without a native top movers surface, users would need to leave the app to check finviz, CoinMarketCap, or other third-party tools. This breaks the decision-support loop and introduces external friction.

---

## 3. The Proposed Solution / Underlying Concept

### Tab Structure

The `TopMoversTabs` component renders two tabs:

- **"US Stocks"** — triggers `GET /api/market/top-movers?type=stocks`
- **"Crypto"** — triggers `GET /api/market/top-movers?type=crypto`

Tab state is managed as local React state. Switching tabs re-fetches the corresponding data.

### Data Display

Each tab renders a `TopMoversTable` (see `02_top_movers_table.md`) showing:
- Top 5 gainers (sorted by `daily_change_pct` descending)
- Top 5 losers (sorted by `daily_change_pct` ascending)

### Loading State

During data fetch, `LoadingSkeleton` is rendered in place of the table. This ensures the layout does not collapse while waiting for the API response.

### Empty / Error State

If all external sources fail and no cached data is available, `EmptyState` is rendered with a message such as "Top movers data unavailable" and a CTA to retry.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Tab switching fetches correct type | Network tab: switch to "Crypto" → verify `?type=crypto` in request |
| Loading skeleton shown | Throttle network → verify skeleton appears during fetch |
| EmptyState when no data | Block Finnhub/FMP/CoinGecko → verify `EmptyState` renders |
| `pnpm build` | Component compiles without errors |
