# Component 10 — Portfolio Projection & Optimization: Implementation Plan

## Overview

v2.0 Markowitz mean-variance portfolio optimization engine on Railway (FastAPI + scipy), returning 3 strategy allocations with 3-month forward projections. Stale-while-revalidate cache for yfinance data. Next.js proxy route hides Railway key from browser.

## Dependencies

- **Component 01:** Auth Foundation (middleware, Supabase clients)
- **Component 02:** Portfolio Data Layer (holdings, target weights, silo detail page)
- **Component 03:** Rebalancing Engine (Apply Weights populates weight editor)
- **Component 08:** AI Research Hub (v2.0 release sequencing — Phase 10 after Phase 8)

## Architecture Reference

- `docs/architecture/components/10_portfolio_projection_optimization/`

---

## Sprint 1 — Railway FastAPI Service

**Goal:** Python optimization microservice on Railway with 3 strategies.

| Task | File | Summary |
|------|------|---------|
| TS.1.1 | `sprint1/TS.1.1_railway_service.md` | FastAPI app, CORS, X-API-Key auth |
| TS.1.2 | `sprint1/TS.1.2_optimizer_endpoint.md` | POST /optimize — cache-first price → truncation → scipy SLSQP |
| TS.1.3 | `sprint1/TS.1.3_backfill_endpoint.md` | POST /backfill_debut — yfinance 5yr → market_debut_date |
| TS.1.4 | `sprint1/TS.1.4_historical_data_table.md` | asset_historical_data migration + 24h TTL cache |

---

## Sprint 2 — Next.js Proxy & Frontend UI

**Goal:** Proxy route, simulation button, results table, strategy cards.

| Task | File | Summary |
|------|------|---------|
| TS.2.1 | `sprint2/TS.2.1_proxy_route.md` | app/api/optimize/route.ts — proxy to Railway |
| TS.2.2 | `sprint2/TS.2.2_simulation_button.md` | SimulateScenariosButton with constraint logic |
| TS.2.3 | `sprint2/TS.2.3_simulation_results.md` | SimulationResultsTable + StrategyCard × 3 |
| TS.2.4 | `sprint2/TS.2.4_apply_weights.md` | Apply Weights → populate weight editor (no API call) |

---

## Sprint 3 — Testing & Polish

**Goal:** Unit tests, integration tests, E2E tests.

| Task | File | Summary |
|------|------|---------|
| TS.3.1 | `sprint3/TS.3.1_python_tests.md` | Python unit tests: scipy optimization, truncation, formatting |
| TS.3.2 | `sprint3/TS.3.2_frontend_tests.md` | Vitest: constraint hook, deduplication, type validation |
| TS.3.3 | `sprint3/TS.3.3_e2e_tests.md` | E2E: simulate → results → apply weights → verify |
