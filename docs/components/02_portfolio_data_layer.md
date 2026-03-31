# Component 2 — Portfolio Data Layer

## 1. The Goal

Be the authoritative source of truth for all portfolio state: silos, holdings, target weights, drift calculations, FX rates, and the USD conversion toggle. This component provides all the CRUD API routes and UI surfaces for managing a user's multi-platform investment silos, entering and editing manual holdings, and computing per-asset drift versus target allocation. It also powers the global Overview page and the daily drift digest notification system.

---

## 2. The Problem It Solves

Investors manage portfolios across disconnected platforms. Rebalancify needs to represent each platform as an independent "silo" with its own holdings, target weights, and drift state. Without a unified data layer:

- There is no single source of truth for what assets a user holds and in what quantity
- Drift cannot be computed without consistent, current prices
- The Overview page cannot aggregate across silos without a central API
- The daily drift digest has no data to evaluate

This component also solves the multi-currency problem — users with Thai Baht or other non-USD silos need to see their total portfolio value normalised to USD.

---

## 3. The Proposed Solution / Underlying Concept

### Silo CRUD (STORY-005)

A silo represents one investment platform (Alpaca, BITKUB, InnovestX, Charles Schwab, Webull, or Manual). Each user may have a maximum of **5 active silos**. The enforcement is at the API layer — `POST /api/silos` checks `SELECT COUNT(*) FROM silos WHERE user_id = $1 AND is_active = TRUE` and returns HTTP 422 with `code: "SILO_LIMIT_REACHED"` if the count is already 5.

`DELETE /api/silos/:id` is a **soft delete** (`is_active = FALSE`), not a hard row deletion. This preserves historical data for the rebalance history audit trail.

### Asset Search & Ticker Mapping (STORY-006)

Asset search is delegated to external providers based on asset type:

- **Stocks/ETFs** → Finnhub `/search` endpoint
- **Crypto** → CoinGecko `/search` endpoint

When a user confirms a ticker for a specific silo, a permanent `asset_mappings` row is created — `(silo_id, asset_id)` is unique. The same ticker can appear in multiple silos (each with its own mapping), but never twice in the same silo. Attempting to add a duplicate returns HTTP 409 `ASSET_MAPPING_EXISTS`.

After mapping, the asset's current price is fetched and cached in `price_cache` (via `priceService.ts`).

### Manual Holdings (STORY-007)

Manual silos allow direct quantity and cost-basis entry. Key rules:

- `price` in the POST request body is **ignored** — price always comes from `price_cache`
- Staleness is computed: `stale_days > 7` triggers a `StalenessTag` on the holding row
- Inline editing (click → input → blur → save) uses optimistic TanStack Query updates

### Target Weights (STORY-008)

Target weights do **not** need to sum to 100%. The remainder is treated as a cash target:

```
weights_sum_pct    = SUM(weight_pct) over all weight rows
cash_target_pct    = 100 - weights_sum_pct
sum_warning        = weights_sum_pct != 100
```

`PUT /api/silos/:id/target-weights` atomically replaces all weight rows for the silo. A `useDirtyGuard` hook adds a `beforeunload` confirmation when the user has unsaved changes.

### Drift Calculation (STORY-017)

Drift is computed live on every request (no historical storage):

```
drift_pct = current_weight_pct - target_weight_pct
```

Drift state thresholds (per-silo `drift_threshold`, default 5.0%):

| State | Condition | Icon |
|---|---|---|
| Green | `ABS(drift_pct) <= drift_threshold` | `Circle` |
| Yellow | `threshold < ABS(drift_pct) <= threshold + 2` | `Triangle` |
| Red | `ABS(drift_pct) > threshold + 2` | `AlertCircle` |

The `GET /api/silos/:id/drift` endpoint computes this from `holdings`, `target_weights`, and `price_cache` at request time.

### FX Rates & USD Toggle (STORY-018)

`GET /api/fx-rates` returns all rates with a **60-minute TTL** from the `fx_rates` table. If the cached rate is stale, it calls the ExchangeRate-API and upserts fresh data. If ExchangeRate-API is unavailable, it returns the stale cached rate (no error).

The `show_usd_toggle` in `user_profiles` persists across sessions. When toggled on, all silo values are converted to USD using `rate_to_usd` — display only, no DB writes.

### Overview Page (STORY-019)

The Overview aggregates across all of a user's silos:

- `PortfolioSummaryCard`: total portfolio value, active silo count `[X/5]`, total unique assets
- `GlobalDriftBanner`: shown only when ≥1 asset in any silo is drift-breached
- `SiloCardGrid`: all active silos, each showing name, platform badge, execution mode, total value, drift state summary
- `AlpacaLiveBadge`: amber LIVE badge on Alpaca silos where `alpaca_mode = 'live'`

### Daily Drift Digest (STORY-020)

Two-part architecture (ADR-013):

1. **pg_cron job** (migration 17, runs daily 08:00 UTC) — SQL-only, queries for drift breaches, inserts rows into the `notifications` table. Does NOT call Resend.
2. **Vercel Cron Job** (`app/api/cron/drift-digest/route.ts`) — reads users with `drift_notif_channel IN ('email', 'both')` who have breach notifications pending, sends digest email via Resend. `CRON_SECRET` header authentication required.

Additionally checks `schwab_token_expires < NOW() + INTERVAL '2 days'` and inserts a `schwab_token_expiring` notification.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Silo limit enforcement | Unit test: mock DB count = 5 → `POST /api/silos` returns 422 `SILO_LIMIT_REACHED` |
| RLS isolation | Two-user DB test: User B cannot SELECT User A's silos |
| Price cache TTL | Second price fetch within 15 min → zero external API calls (call count assertion) |
| Duplicate mapping | `POST /api/silos/:id/asset-mappings` with existing ticker → HTTP 409 |
| Same ticker, different silo | `POST /api/silos/:id/asset-mappings` with same ticker but different silo → two mappings |
| Drift three-state | Unit test: threshold = 5.0 → all three states trigger at correct boundaries |
| Custom drift threshold | `PATCH /api/silos/:id` updates `drift_threshold` → recalculated on next `GET /api/silos/:id/drift` |
| FX TTL | Second call within 60 min → no ExchangeRate-API call |
| FX graceful degradation | ExchangeRate-API unavailable → returns cached rates with original `fetched_at` |
| USD toggle persistence | Toggle on → `PATCH /api/profile` → refresh page → toggle still on |
| Dirty guard | Edit weight → attempt nav → `beforeunload` fires → confirm save → guard clears |
| No historical drift storage | `grep` for `drift_history` table/column → zero results |
| `formatNumber` | Unit tests for all format types and edge cases (currency, weight %, drift %, etc.) |
| No inline number formatting | `grep /\.toFixed\(/` in components → zero hits |

---

## 5. Integration

### API Routes (all under `/api/`)

| Method + Path | What It Does |
|---|---|
| `GET /api/profile` | Returns profile with `active_silo_count`, `silo_limit: 5`, `show_usd_toggle`, `notification_count` |
| `PATCH /api/profile` | Updates `display_name`, `drift_notif_channel`, broker keys (encrypted), `show_usd_toggle` |
| `GET /api/silos` | Returns all active silos with `total_value: "0.00000000"` until holdings added |
| `POST /api/silos` | Creates silo (enforces 5-silo limit, HTTP 422 if exceeded) |
| `PATCH /api/silos/:id` | Updates silo name, `drift_threshold` |
| `DELETE /api/silos/:id` | Soft-delete (`is_active = FALSE`) |
| `GET /api/silos/:id/drift` | Live drift computation per asset |
| `GET /api/silos/:id/holdings` | All holdings with derived fields (current_price, value, weight, drift) |
| `POST /api/silos/:id/holdings` | Create holding (price ignored, sourced from cache) |
| `PATCH /api/silos/:id/holdings/:id` | Update `quantity` or `cost_basis` |
| `GET /api/silos/:id/target-weights` | All target weight rows |
| `PUT /api/silos/:id/target-weights` | Atomically replace all weights, returns `weights_sum_pct`, `cash_target_pct`, `sum_warning` |
| `GET /api/assets/search` | Finnhub (stocks) or CoinGecko (crypto) search |
| `POST /api/silos/:id/asset-mappings` | Confirm ticker for silo, fetch + cache price |
| `GET /api/fx-rates` | All FX rates (60-min TTL) |
| `POST /api/silos/:id/sync` | Broker-specific sync (Alpaca in EPIC-03, others in EPIC-04) |

### Database Tables (managed here, belong to Component 1's schema)

| Table | RLS | Purpose |
|---|---|---|
| `silos` | Yes | Platform silos (max 5 per user) |
| `asset_mappings` | Yes | Permanent ticker-to-silo mapping (unique per silo) |
| `holdings` | Yes | Per-silo asset positions with quantity, cost_basis |
| `target_weights` | Yes | Per-silo target weight percentages |
| `notifications` | Yes | In-app notifications (drift breaches, Schwab token expiry) |
| `assets` | Read-all | Global asset reference (ticker, name, type) |
| `price_cache` | Read-all | Latest price per asset (15-min TTL) |
| `fx_rates` | Read-all | USD conversion rates (60-min TTL) |

### Feeds Into

| Component | How |
|---|---|
| **Component 3 — Rebalancing Engine** | Reads holdings, prices, weights for order calculation |
| **Component 4 — Broker Integration** | Sync endpoints populate holdings in this layer |
| **Component 5 — Market Data** | Called for `price_cache` lookups and `fx_rates` |
| **Component 6 — News Feed** | Reads portfolio ticker list for two-tier filtering |
| **Component 7 — Asset Discovery** | Reads drift data for per-silo drift mini-summary on Discover page |
| **Component 9 — PWA** | `EmptyState`, `ErrorBanner`, `LoadingSkeleton` consumed by all data-fetching pages |

### Consumed From

| Component | What It Provides |
|---|---|
| **Component 1 — Auth & Foundation** | `SessionContext` (`siloCount`), AppShell, `lib/supabase/server.ts` |
| **Component 5 — Market Data** | `priceService.ts` for price_cache lookups and three-tier fetching |

### Key Shared Utilities

- `lib/formatNumber.ts` — all numeric display formatting (currency, weight %, drift %, quantity)
- `lib/priceService.ts` — three-tier price fetching with 15-min cache TTL
- `hooks/useDirtyGuard.ts` — `beforeunload` guard for unsaved forms
