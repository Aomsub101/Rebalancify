# docs/prd/features/F2-platform-silos.md — Feature 2: Platform-Specific Account Silos

## AGENT CONTEXT

**What this file is:** Requirements for the platform silo system — isolated portfolio containers that map 1:1 to real investment platforms.
**Derived from:** PRD_v1.3.md Section 6 Feature 2, FEATURES_v1.3.txt Feature 2
**Connected to:** docs/architecture/02-database-schema.md (silos, holdings, target_weights, fx_rates), docs/architecture/03-api-contract.md (Sections 5–8), docs/architecture/04-component-tree.md (Sections 2.2–2.3), stories/EPIC-02-silos-holdings/, stories/EPIC-04-broker-fetch/
**Critical rules for agents using this file:**
- F2-R1 silo limit of 5 is enforced at the API layer before every INSERT into silos. See CLAUDE.md Rule 8.
- F2-R3 silo isolation is absolute — see also F1-R9.
- F2-R5 USD conversion is display-only. It must never affect rebalancing calculations.

---

## Feature Purpose

Users create isolated portfolio containers that map 1:1 to their real investment platforms. Capital cannot flow between silos. Each silo has its own currency, holdings, and target weights. A global overview aggregates all silos with an optional USD display toggle.

---

## Requirements

### F2-R1 — Maximum 5 Active Silos Per User

Users may create up to **5 active platform silos** per account. Each silo is named by the user and maps to exactly one real-world investment platform.

**Enforcement:** Before any `INSERT` into `silos`, the API checks `SELECT COUNT(*) FROM silos WHERE user_id = $1 AND is_active = TRUE`. If count >= 5, return HTTP 422 with `{ error: { code: "SILO_LIMIT_REACHED", message: "Maximum of 5 active silos reached", detail: "Deactivate or delete an existing silo to create a new one." } }`.

**UI enforcement:** The "Create silo" button is disabled (with tooltip "You have reached the maximum of 5 silos") when `active_silo_count >= 5`. The `SiloCountBadge` in the sidebar always shows `[X/5]`.

**Acceptance test:** Given a user with 5 active silos, when `POST /silos` is called, then the response is HTTP 422 with code `SILO_LIMIT_REACHED`.

**Acceptance test:** Given a user with 5 active silos, when one silo is deleted (`is_active = FALSE`), then `POST /silos` succeeds (active count is now 4).

---

### F2-R2 — Per-Silo Base Currency

Each silo has an independently configurable base currency set at creation time. Default currencies by platform:

| Platform | Default Base Currency |
|---|---|
| Alpaca | USD |
| BITKUB | THB |
| InnovestX | THB |
| Charles Schwab | USD |
| Webull | USD |
| DIME | THB |
| manual | USD (user-configurable) |

**Implementation constraint:** `base_currency` is set on `POST /silos` and is updateable via `PATCH /silos/:id`. All calculations within a silo use only that silo's base currency. Currency conversion never happens during rebalancing.

---

### F2-R3 — Silo Isolation for Calculations and Execution

Rebalancing calculations and API order executions are strictly isolated within their silo. The engine must never perform calculations referencing holdings, cash, or weights from a different silo.

This requirement is identical to F1-R9. It is restated here as a silo-system requirement because isolation is a silo-level architectural guarantee, not just a calculator concern.

---

### F2-R4 — Global Overview Aggregation

The global portfolio overview displays an aggregated view across all silos. If the same asset ticker exists in more than one silo, it appears as a combined position in the overview. However, for all rebalancing operations it remains an independent position within each respective silo.

**Implementation constraint:** The Overview page aggregates by computing `SUM(holdings.quantity * price_cache.price)` grouped by `asset_id` across all of the user's active silos. This is a derived view — no table stores this aggregated data.

---

### F2-R5 — "Convert All to USD" Toggle

The global overview provides a "Convert all to USD" toggle (default: off). When enabled, all silo values are converted to USD for display using live rates from ExchangeRate-API (60-min TTL). When disabled, each silo displays in its own base currency.

**Implementation constraint:** This toggle affects display only. It must not affect any calculation. The converted value is computed on the frontend using `fx_rates.rate_to_usd`. The toggle state is stored in `user_profiles.show_usd_toggle`.

**Free tier constraint:** ExchangeRate-API free tier provides 1,500 requests per month. With a 60-minute TTL and typical usage, this is sufficient for low traffic but will be exhausted if many users refresh frequently. Monitor usage in the Vercel dashboard (see `docs/development/04-deployment.md` monthly checklist).

**Failure modes:**
- **Transient outage:** disable the toggle, show "FX data unavailable" in place of the toggle control. Retry on next page load.
- **Monthly quota exhausted (HTTP 429):** same UI behaviour as outage, but recovery is automatic on the 1st of the following month. Log the 429 to server logs with the label `EXCHANGERATE_QUOTA_EXHAUSTED` so it is distinguishable from a network failure.

---

### F2-R6 — Portfolio Drift Indicator and Alerts

A Portfolio Drift Indicator monitors each asset within each silo independently. An alert is triggered when `ABS(current_weight_pct - target_weight_pct) > drift_threshold`.

**Default drift threshold:** 5% (per silo, configurable in silo settings).

**Alert delivery:** Daily digest via Resend (email) and/or in-app notification on next login — user-configurable in Settings via `drift_notif_channel` (`'app' | 'email' | 'both'`).

**Three-state visual:**
- Green: drift within threshold
- Yellow: drift within 2% of the threshold (approaching)
- Red: drift exceeds threshold

**Drift is current-snapshot only.** No historical drift data is stored.

---

### F2-R7 — Platform Capability Matrix

Full specification: `docs/prd/06-platform-support.md`. Summary for implementation:

| Platform | v1.0 Holding Fetch | v1.0 Execution | v2.0 Execution |
|---|---|---|---|
| Alpaca | Automated | Automated (user-approved) | — |
| BITKUB | Automated | Manual instructions only | Automated |
| InnovestX | Automated | Manual instructions only | Automated |
| Charles Schwab | Automated | Manual instructions only | Automated |
| Webull | Automated | Manual instructions only | Automated |
| DIME | Manual entry | — | — |
| All others | Manual entry | — | — |

**UI requirement for manual execution:** When a non-Alpaca API silo generates a rebalancing plan, the `ExecutionModeNotice` component on Step 2 of the wizard must read: `"These orders will not be submitted automatically. After reviewing, you will execute them manually on [Platform Name]."` This banner is persistent (cannot be dismissed) and is visible on every non-Alpaca session.
