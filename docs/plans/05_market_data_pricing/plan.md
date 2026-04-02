# Component 05 — Market Data & Pricing: Implementation Plan

## Overview

Cross-cutting price infrastructure: two-tier price fetching (cache-first → external APIs), FX rates service, sector taxonomy for peer fallback, and top movers endpoint. Every component needing current prices calls through this layer.

## Dependencies

- **Component 01:** Auth Foundation (Supabase clients, middleware)
- **Component 02:** Portfolio Data Layer (price_cache table, fx_rates table)

## Architecture Reference

- `docs/architecture/components/05_market_data_pricing/`

---

## Sprint 1 — Price Service & Cache

**Goal:** Core price fetching with Finnhub + CoinGecko and 15-min TTL cache.

| Task | File | Summary |
|------|------|---------|
| TS.1.1 | `sprint1/TS.1.1_price_service_core.md` | lib/priceService.ts — cache-first, multi-source |
| TS.1.2 | `sprint1/TS.1.2_price_cache_migration.md` | price_cache table + price_cache_fresh view |
| TS.1.3 | `sprint1/TS.1.3_price_api_route.md` | GET /api/prices/[asset_id] route |

---

## Sprint 2 — FX Rates & Top Movers

**Goal:** FX rate caching, top movers endpoint, sector taxonomy.

| Task | File | Summary |
|------|------|---------|
| TS.2.1 | `sprint2/TS.2.1_fx_rates_service.md` | lib/fxRates.ts + GET /api/fx-rates (60-min TTL) |
| TS.2.2 | `sprint2/TS.2.2_top_movers_route.md` | GET /api/market/top-movers (stocks + crypto) |
| TS.2.3 | `sprint2/TS.2.3_sector_taxonomy.md` | sector_taxonomy.json static fallback |

---

## Sprint 3 — Testing & Error Handling

**Goal:** Comprehensive tests, graceful degradation, quota handling.

| Task | File | Summary |
|------|------|---------|
| TS.3.1 | `sprint3/TS.3.1_unit_tests.md` | Unit: TTL logic, rate inversion, fallback chains |
| TS.3.2 | `sprint3/TS.3.2_integration_tests.md` | Integration: cache TTL, API failure fallback |
| TS.3.3 | `sprint3/TS.3.3_quota_handling.md` | ExchangeRate-API quota exhaustion, Finnhub rate limits |
