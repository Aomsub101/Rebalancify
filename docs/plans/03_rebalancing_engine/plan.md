# Component 03 — Rebalancing Engine: Implementation Plan

## Overview

Compute buy/sell orders to reach target weights, create immutable audit snapshots, execute orders against Alpaca (paper/live), and present a 3-step wizard UI. AES-256-GCM encryption for broker credentials.

## Dependencies

- **Component 01:** Auth Foundation (AppShell, SessionContext, Supabase clients)
- **Component 02:** Portfolio Data Layer (holdings, prices, weights, FX rates)

## Architecture Reference

- `docs/architecture/components/03_rebalancing_engine/`
- `docs/architecture/02-database-schema.md` (rebalance_sessions, rebalance_orders)

---

## Sprint 1 — Encryption & Alpaca Credentials

**Goal:** AES-256-GCM encryption utility, Alpaca key storage, Settings UI.

| Task | File | Summary |
|------|------|---------|
| TS.1.1 | `sprint1/TS.1.1_encryption_utility.md` | AES-256-GCM encrypt/decrypt with random IV |
| TS.1.2 | `sprint1/TS.1.2_alpaca_key_storage.md` | PATCH /api/profile for Alpaca key/secret encryption |
| TS.1.3 | `sprint1/TS.1.3_alpaca_settings_ui.md` | Settings page Alpaca section (masked inputs, paper/live) |
| TS.1.4 | `sprint1/TS.1.4_alpaca_sync.md` | POST /api/silos/:id/sync for Alpaca positions + cash |

---

## Sprint 2 — Rebalance Calculator

**Goal:** Pure rebalance engine function with partial/full modes.

| Task | File | Summary |
|------|------|---------|
| TS.2.1 | `sprint2/TS.2.1_rebalance_engine.md` | lib/rebalanceEngine.ts — pure function, no DB |
| TS.2.2 | `sprint2/TS.2.2_calculate_route.md` | POST /api/silos/:id/rebalance/calculate |
| TS.2.3 | `sprint2/TS.2.3_rebalance_history.md` | GET /api/silos/:id/rebalance/history + global history |

---

## Sprint 3 — Order Execution

**Goal:** Execute orders against Alpaca API, store results.

| Task | File | Summary |
|------|------|---------|
| TS.3.1 | `sprint3/TS.3.1_execute_route.md` | POST /api/silos/:id/rebalance/execute for Alpaca |
| TS.3.2 | `sprint3/TS.3.2_manual_execution.md` | Manual instruction generation for non-Alpaca silos |
| TS.3.3 | `sprint3/TS.3.3_confirm_dialog.md` | Non-dismissible ConfirmDialog component |

---

## Sprint 4 — 3-Step Wizard UI

**Goal:** Full rebalancing wizard: Config → Review → Result.

| Task | File | Summary |
|------|------|---------|
| TS.4.1 | `sprint4/TS.4.1_wizard_orchestrator.md` | RebalancePage with StepIndicator |
| TS.4.2 | `sprint4/TS.4.2_config_panel.md` | Step 1: mode selector, cash toggle, WeightsSumWarning |
| TS.4.3 | `sprint4/TS.4.3_order_review_panel.md` | Step 2: OrdersTable with skip checkboxes |
| TS.4.4 | `sprint4/TS.4.4_execution_result_panel.md` | Step 3: per-order status, manual instructions |

---

## Sprint 5 — History UI & Testing

**Goal:** Rebalance history page, comprehensive tests.

| Task | File | Summary |
|------|------|---------|
| TS.5.1 | `sprint5/TS.5.1_history_page.md` | Rebalance history page UI |
| TS.5.2 | `sprint5/TS.5.2_unit_tests.md` | Unit: encryption, partial/full mode, pre-flight |
| TS.5.3 | `sprint5/TS.5.3_integration_tests.md` | Integration: calculate → execute flow |
| TS.5.4 | `sprint5/TS.5.4_e2e_tests.md` | E2E: full wizard flow with Alpaca mock |
