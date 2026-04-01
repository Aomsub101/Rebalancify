# Component 2 — Portfolio Data Layer: As-Built PRD

> Reverse-engineered from implementation as of 2026-04-01. All facts derived from verified source files — no speculation.

---

## 1. The Goal

Be the authoritative source of truth for all portfolio state: silos, holdings, target weights, drift calculations, FX rates, and the USD conversion toggle. This component provides all the CRUD API routes and UI surfaces for managing a user's multi-platform investment silos, entering and editing manual holdings, and computing per-asset drift versus target allocation. It also powers the global Overview page and the daily drift digest notification system.

---

## 2. The Problem It Solves

Investors manage portfolios across disconnected platforms. Rebalancify represents each platform as an independent "silo" with its own holdings, target weights, and drift state. Without a unified data layer:

- There is no single source of truth for what assets a user holds and in what quantity
- Drift cannot be computed without consistent, current prices
- The Overview page cannot aggregate across silos without a central API
- The daily drift digest has no data to evaluate

This component also solves the multi-currency problem — users with Thai Baht or other non-USD silos need to see their total portfolio value normalised to USD.

---

## 3. The Proposed Solution / Underlying Concept

### Silo CRUD

A silo represents one investment platform (Alpaca, BITKUB, InnovestX, Charles Schwab, Webull, or Manual). Maximum **5 active silos** per user, enforced at the API layer — `POST /api/silos` checks the count and returns HTTP 422 with `code: "SILO_LIMIT_REACHED"` if exceeded.

`DELETE /api/silos/:id` is a **soft delete** (`is_active = FALSE`), preserving historical data.

### Asset Search & Ticker Mapping

Asset search is delegated to external providers based on asset type: Finnhub for stocks/ETFs, CoinGecko for crypto. When a user confirms a ticker for a specific silo, a permanent `asset_mappings` row is created — `(silo_id, asset_id)` is unique. Duplicate mapping returns HTTP 409 `ASSET_MAPPING_EXISTS`.

### Manual Holdings

Manual silos allow direct quantity and cost-basis entry. `price` in POST requests is **ignored** — price always comes from `price_cache`. Staleness is computed: `stale_days > 7` triggers a `StalenessTag` on the holding row.

### Target Weights

Target weights do **not** need to sum to 100%. The remainder is treated as a cash target. `PUT /api/silos/:id/target-weights` atomically replaces all weight rows and returns `weights_sum_pct`, `cash_target_pct`, and `sum_warning`.

### Drift Calculation

Drift is computed live on every request (no historical storage). Three-state classification:

| State | Condition | Icon |
|---|---|---|
| Green | `ABS(drift_pct) <= drift_threshold` | `Circle` |
| Yellow | `threshold < ABS(drift_pct) <= threshold + 2` | `Triangle` |
| Red | `ABS(drift_pct) > threshold + 2` | `AlertCircle` |

### FX Rates & USD Toggle

`GET /api/fx-rates` returns cached rates with a **60-minute TTL**. If stale, it calls ExchangeRate-API and upserts fresh data. If ExchangeRate-API is unavailable, it returns the stale cached rate (no error).

The `show_usd_toggle` in `user_profiles` persists across sessions. When toggled on, all silo values are converted to USD using `rate_to_usd` — display only, no DB writes.

### Overview Page

The Overview aggregates across all silos: `PortfolioSummaryCard` (total value, active silos, unique assets), `GlobalDriftBanner` (shown when any asset is drift-breached), `SiloCardGrid` with per-silo `AlpacaLiveBadge` and drift status summary.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Silo limit enforcement | Unit test: mock DB count = 5 → `POST /api/silos` returns 422 |
| RLS isolation | Two-user DB test: User B cannot SELECT User A's silos |
| Price cache TTL | Second price fetch within 15 min → zero external API calls |
| Duplicate mapping | `POST /api/silos/:id/asset-mappings` with existing ticker → HTTP 409 |
| Drift three-state | Unit test: all three states trigger at correct boundaries |
| FX TTL | Second call within 60 min → no ExchangeRate-API call |
| FX graceful degradation | ExchangeRate-API unavailable → returns cached rates |
| Dirty guard | Edit weight → attempt nav → `beforeunload` fires |
| No historical drift storage | `grep drift_history` → zero results |
| `formatNumber` | Unit tests for all format types |

---

## 5. Integration

### Sub-Components

| Sub-Component | File |
|---|---|
| Silo CRUD API | `01-silo_crud_api.md` |
| Silo Detail Pages | `02-silo_detail_pages.md` |
| Drift Calculation | `03-drift_calculation.md` |
| Holdings API | `04-holdings_api.md` |
| Target Weights API | `05-target_weights_api.md` |
| FX Rates & USD Toggle | `06-fx_rates_usd_toggle.md` |
| Asset Search & Mapping | `07-asset_search_mapping.md` |
| Price Service | `08-price_service.md` |
| Format Number Utility | `09-format_number.md` |
| Overview Page | `10-overview_page.md` |

### Consumed From
- **Component 1 — Auth & Foundation** — `SessionContext`, AppShell, `lib/supabase/server.ts`
- **Component 5 — Market Data** — `priceService.ts` for price_cache lookups

### Feeds Into
- **Component 3 — Rebalancing Engine** — holdings, prices, weights
- **Component 4 — Broker Integration** — sync endpoints populate holdings
- **Component 5 — Market Data** — called for `price_cache` and `fx_rates`
- **Component 6 — News Feed** — reads portfolio ticker list
- **Component 7 — Asset Discovery** — drift data for Discover page
- **Component 9 — PWA** — shared utility components
