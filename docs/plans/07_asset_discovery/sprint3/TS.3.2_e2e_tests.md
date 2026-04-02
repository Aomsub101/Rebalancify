# TS.3.2 — E2E Tests

## Task
Write Playwright E2E tests for the Discover page.

## Target
`tests/e2e/discover.spec.ts`

## Process
1. `tests/e2e/discover.spec.ts`:
   - **Three sections render:** TopMoversTabs, AssetPeerSearch, PortfolioDriftSummary
   - **Tab switching:** US Stocks → Crypto → verify data changes
   - **Top movers icons:** Gainers have green bg + TrendingUp, losers have red bg + TrendingDown
   - **Peer search:** Search "AAPL" → peer cards appear with ticker, name, price
   - **Peer fallback:** Mock Finnhub failure → static peers still shown
   - **Drift summary:** User with silos → drift mini-summary visible
   - **Empty states:** User with no silos → appropriate empty states
   - **Navigation:** Click PeerCard → navigates to /research/[ticker]
   - **LoadingSkeleton:** Throttle network → skeletons visible during load
2. Mock external APIs via Playwright route interception

## Outputs
- `tests/e2e/discover.spec.ts`

## Verify
- `pnpm test:e2e -- discover.spec.ts` passes all tests

## Handoff
→ Component 07 complete
