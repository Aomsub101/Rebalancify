# Component 04 — Broker Integration Layer: Implementation Plan

## Overview

Fetch holdings from BITKUB, InnovestX (equity + digital), Schwab (OAuth), and Webull. All credentials encrypted with AES-256-GCM. Order execution deferred to v2.0 (Component 09).

## Dependencies

- **Component 01:** Auth Foundation (middleware, Supabase clients)
- **Component 02:** Portfolio Data Layer (holdings, silo CRUD)
- **Component 03:** Rebalancing Engine (encryption utility, key storage pattern)

## Architecture Reference

- `docs/architecture/components/04_broker_integration_layer/`

---

## Sprint 1 — BITKUB Integration

**Goal:** BITKUB key storage, sync endpoint, price cache from ticker.

| Task | File | Summary |
|------|------|---------|
| TS.1.1 | `sprint1/TS.1.1_bitkub_key_storage.md` | PATCH /api/profile for BITKUB key/secret |
| TS.1.2 | `sprint1/TS.1.2_bitkub_sync.md` | POST /api/silos/:id/sync for BITKUB (HMAC-SHA256) |
| TS.1.3 | `sprint1/TS.1.3_bitkub_price_cache.md` | Upsert price_cache from BITKUB ticker data |

---

## Sprint 2 — InnovestX Dual-Branch Sync

**Goal:** InnovestX equity (Settrade OAuth) + digital asset (HMAC) sync.

| Task | File | Summary |
|------|------|---------|
| TS.2.1 | `sprint2/TS.2.1_innovestx_key_storage.md` | PATCH /api/profile for both InnovestX credential pairs |
| TS.2.2 | `sprint2/TS.2.2_innovestx_equity_sync.md` | Settrade OAuth → portfolio positions |
| TS.2.3 | `sprint2/TS.2.3_innovestx_digital_sync.md` | HMAC-SHA256 digital asset balance inquiry |

---

## Sprint 3 — Schwab OAuth + Webull

**Goal:** Schwab OAuth flow + sync, Webull HMAC sync.

| Task | File | Summary |
|------|------|---------|
| TS.3.1 | `sprint3/TS.3.1_schwab_oauth.md` | GET /api/auth/schwab + callback (CSRF, token exchange) |
| TS.3.2 | `sprint3/TS.3.2_schwab_sync.md` | POST /api/silos/:id/sync for Schwab |
| TS.3.3 | `sprint3/TS.3.3_webull_sync.md` | POST /api/silos/:id/sync for Webull (HMAC-SHA256) |
| TS.3.4 | `sprint3/TS.3.4_schwab_token_expiry.md` | Token expiry cron + notification |

---

## Sprint 4 — Settings UI & ExecutionModeNotice

**Goal:** Broker sections in Settings, ExecutionModeNotice banner.

| Task | File | Summary |
|------|------|---------|
| TS.4.1 | `sprint4/TS.4.1_settings_broker_sections.md` | BITKUB, InnovestX, Schwab, Webull settings sections |
| TS.4.2 | `sprint4/TS.4.2_connection_status.md` | ConnectionStatusDot, TokenExpiryWarning components |
| TS.4.3 | `sprint4/TS.4.3_execution_mode_notice.md` | Non-dismissible banner in rebalance wizard Step 2 |

---

## Sprint 5 — Testing

**Goal:** Unit, integration, and E2E tests for all broker syncs.

| Task | File | Summary |
|------|------|---------|
| TS.5.1 | `sprint5/TS.5.1_unit_tests.md` | HMAC signature generation, credential validation |
| TS.5.2 | `sprint5/TS.5.2_integration_tests.md` | Sync flow with mocked broker APIs |
| TS.5.3 | `sprint5/TS.5.3_e2e_tests.md` | Settings → connect → sync → holdings visible |
