# Component 02 — Portfolio Data Layer: Implementation Plan

## Overview

Authoritative source of truth for all portfolio state: silos, holdings, target weights, drift calculations, FX rates, USD toggle, and the Overview page. Provides all CRUD API routes and UI surfaces for managing multi-platform investment silos.

## Dependencies

- **Component 01:** Auth Foundation (SessionContext, AppShell, Supabase clients, middleware)
- **Component 05:** Market Data & Pricing (priceService for price_cache lookups)

## Architecture Reference

- `docs/architecture/components/02_portfolio_data_layer/`
- `docs/architecture/02-database-schema.md`
- `docs/architecture/03-api-contract.md`

---

## Sprint 1 — Silo CRUD & Asset Search

**Goal:** Users can create/edit/delete silos and search for assets to add.

| Task | File | Summary |
|------|------|---------|
| TS.1.1 | `sprint1/TS.1.1_silo_crud_api.md` | GET/POST/PATCH/DELETE /api/silos with 5-silo limit |
| TS.1.2 | `sprint1/TS.1.2_silos_list_page.md` | Silos list page + Create silo form |
| TS.1.3 | `sprint1/TS.1.3_asset_search_api.md` | GET /api/assets/search (Finnhub + CoinGecko) |
| TS.1.4 | `sprint1/TS.1.4_asset_mapping_api.md` | POST /api/silos/:id/asset-mappings (upsert + mapping) |

---

## Sprint 2 — Holdings & Target Weights

**Goal:** Manual holdings entry, target weight management, price integration.

| Task | File | Summary |
|------|------|---------|
| TS.2.1 | `sprint2/TS.2.1_holdings_api.md` | GET/POST/PATCH holdings with derived fields |
| TS.2.2 | `sprint2/TS.2.2_target_weights_api.md` | PUT /api/silos/:id/target-weights (atomic replace) |
| TS.2.3 | `sprint2/TS.2.3_price_service.md` | Price fetch service with cache-first strategy |
| TS.2.4 | `sprint2/TS.2.4_silo_detail_page.md` | SiloDetailPage: HoldingsTable, WeightsSumBar, AssetSearchModal |

---

## Sprint 3 — Drift & FX Rates

**Goal:** Live drift calculation, FX rate caching, USD toggle.

| Task | File | Summary |
|------|------|---------|
| TS.3.1 | `sprint3/TS.3.1_drift_calculation.md` | GET /api/silos/:id/drift (three-state: green/yellow/red) |
| TS.3.2 | `sprint3/TS.3.2_drift_badge.md` | DriftBadge + DriftCell components |
| TS.3.3 | `sprint3/TS.3.3_fx_rates_api.md` | GET /api/fx-rates (ExchangeRate-API, 60-min TTL) |
| TS.3.4 | `sprint3/TS.3.4_usd_toggle.md` | USD toggle in TopBar, persisted via profile |

---

## Sprint 4 — Overview Page & Notifications

**Goal:** Global portfolio overview, drift banner, drift digest notifications.

| Task | File | Summary |
|------|------|---------|
| TS.4.1 | `sprint4/TS.4.1_overview_page.md` | PortfolioSummaryCard, SiloCardList, GlobalDriftBanner |
| TS.4.2 | `sprint4/TS.4.2_silo_card.md` | SiloCard component with drift summary + badges |
| TS.4.3 | `sprint4/TS.4.3_drift_digest_cron.md` | Vercel Cron + pg_cron for drift alerts + email digest |
| TS.4.4 | `sprint4/TS.4.4_staleness_warning.md` | StalenessTag on holdings > 7 days old |

---

## Sprint 5 — Testing & Polish

**Goal:** Comprehensive tests, formatNumber integration, dirty guard.

| Task | File | Summary |
|------|------|---------|
| TS.5.1 | `sprint5/TS.5.1_unit_tests.md` | Unit tests: silo limit, drift states, formatNumber |
| TS.5.2 | `sprint5/TS.5.2_api_integration_tests.md` | Integration tests: CRUD, price cache TTL, FX TTL |
| TS.5.3 | `sprint5/TS.5.3_e2e_tests.md` | E2E: create silo → add holdings → set weights → view drift |
| TS.5.4 | `sprint5/TS.5.4_dirty_guard.md` | beforeunload dirty guard on weight editing |
