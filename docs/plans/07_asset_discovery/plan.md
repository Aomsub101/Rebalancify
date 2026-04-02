# Component 07 — Asset Discovery: Implementation Plan

## Overview

Market exploration surface: peer assets per ticker (Finnhub + static fallback), Top Gainers/Losers dashboard (stocks + crypto), and a portfolio drift mini-summary. Entry point for AI Research Hub queries.

## Dependencies

- **Component 01:** Auth Foundation (AppShell, middleware)
- **Component 02:** Portfolio Data Layer (drift data for PortfolioDriftSummary)
- **Component 05:** Market Data & Pricing (priceService, top movers, sector taxonomy)

## Architecture Reference

- `docs/architecture/components/07_asset_discovery/`

---

## Sprint 1 — API Endpoints

**Goal:** Peers endpoint and top movers endpoint.

| Task | File | Summary |
|------|------|---------|
| TS.1.1 | `sprint1/TS.1.1_peers_api.md` | GET /api/assets/:id/peers (Finnhub + static fallback) |
| TS.1.2 | `sprint1/TS.1.2_top_movers_api.md` | GET /api/market/top-movers integration with Discover UI |

---

## Sprint 2 — Discover Page UI

**Goal:** Full Discover page with TopMoversTabs, AssetPeerSearch, PortfolioDriftSummary.

| Task | File | Summary |
|------|------|---------|
| TS.2.1 | `sprint2/TS.2.1_discover_page.md` | DiscoverPage layout with three sections |
| TS.2.2 | `sprint2/TS.2.2_top_movers_ui.md` | TopMoversTabs + TopMoversTable components |
| TS.2.3 | `sprint2/TS.2.3_peer_search_ui.md` | AssetPeerSearch + PeerCard components |
| TS.2.4 | `sprint2/TS.2.4_drift_summary.md` | PortfolioDriftSummary + DriftSiloBlock |

---

## Sprint 3 — Testing

**Goal:** Unit, integration, and E2E tests.

| Task | File | Summary |
|------|------|---------|
| TS.3.1 | `sprint3/TS.3.1_unit_tests.md` | Unit: peer fallback, top movers, color signals |
| TS.3.2 | `sprint3/TS.3.2_e2e_tests.md` | E2E: discover page rendering, search, peer display |
