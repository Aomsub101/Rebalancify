# Component 5 — Market Data & Pricing

## 1. The Goal

Be the cross-cutting price and FX data infrastructure for the entire application. Every component that needs a current price — drift calculation, rebalancing, broker sync, news, discovery — calls through this layer. It implements a three-tier price-fetching strategy (Alpaca → Finnhub → CoinGecko) with a 15-minute TTL cache in `price_cache`, and a separate FX rates service with a 60-minute TTL in `fx_rates`. This component is not an epic unto itself; it is distributed across EPIC-02, EPIC-04, EPIC-05, and EPIC-07.

---

## 2. The Problem It Solves

Without a unified price service, each part of the application would independently call external APIs, hitting rate limits faster, creating inconsistent prices within the same page load, and having no stale-data fallback. The three-tier strategy ensures that prices are always fetched from the most authoritative source available, cached aggressively to avoid unnecessary API calls, and returned from cache gracefully when all external sources are unavailable.

---

## 3. The Proposed Solution / Underlying Concept

### Three-Tier Price Fetching

`lib/priceService.ts` implements the price-fetching decision tree:

```
Is price in price_cache and fresh (fetched_at < 15 min ago)?
  → YES: return cached price (no external call)
  → NO:  proceed to Tier 1

TIER 1a — Alpaca (at sync time only)
  Alpaca sync route fetches prices from Alpaca API and writes directly to price_cache
  during the sync operation. This is the most accurate source for Alpaca users.

TIER 1b — BITKUB ticker
  If asset is on BITKUB: fetch from BITKUB /api/market/ticker
  Write to price_cache, 15-min TTL

TIER 2 — Finnhub /quote
  Stocks and ETFs: Finnhub quote endpoint
  Write to price_cache, 15-min TTL

TIER 3 — CoinGecko /simple/price
  Crypto assets: CoinGecko simple price endpoint (no API key required)
  Write to price_cache, 15-min TTL
```

Cache freshness is checked via the `price_cache_fresh` SQL view:

```sql
CREATE VIEW price_cache_fresh AS
SELECT asset_id, fetched_at
FROM price_cache
WHERE fetched_at > NOW() - INTERVAL '15 minutes';
```

A staleness check queries this view before making an external call.

### `price_cache` Table

| Column | Type | Description |
|---|---|---|
| `asset_id` | uuid | FK to `assets` |
| `price` | NUMERIC(20,8) | Latest price in USD |
| `fetched_at` | timestamptz | When the price was fetched |

`price_cache` is a read-all RLS table — all authenticated users can read it.

### FX Rates

`GET /api/fx-rates` manages non-USD conversion:

- **60-minute TTL** (longer than price cache because FX rates change slowly)
- ExchangeRate-API as the single source of truth
- On fetch success: upsert into `fx_rates` table
- On ExchangeRate-API failure: return stale cached rates with original `fetched_at` (no error)

The `fx_rates` table structure:

| Column | Type | Description |
|---|---|---|
| `currency` | text | ISO 4217 code (e.g., `THB`) |
| `rate_to_usd` | NUMERIC(18,8) | 1 unit of currency = this many USD |
| `fetched_at` | timestamptz | When the rate was fetched |

### `sector_taxonomy.json`

A static JSON file distributed with the application (`/sector_taxonomy.json` or imported from `data/sector_taxonomy.json`) containing 50+ major stocks across 8 sectors. Used as the peer discovery fallback when Finnhub is unavailable. Maintained manually — not fetched from any API.

### Price Display

All monetary values are stored as `NUMERIC(20,8)` strings in the database. The `formatNumber()` utility (Component 2) handles all display formatting. No inline `.toFixed()` or `Intl.NumberFormat` calls are permitted in components.

### Rate Limit Handling

- **Finnhub**: 60 calls/minute (enforced by STORY-021 news service; price service shares the Finnhub quota)
- **CoinGecko**: Free tier, no key required for `/simple/price`
- **ExchangeRate-API**: 60-min TTL ensures minimal calls

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Cache hit — no external call | Unit test: call `priceService.getPrice(asset)` twice within 15 min → external call count = 1 |
| Cache miss — external call | Unit test: asset not in cache → verify correct tier API called |
| BITKUB ticker used for crypto | Integration: BITKUB silo sync → verify `/api/market/ticker` called, price_cache updated |
| Finnhub used for stocks | Integration: non-BITKUB stock → verify Finnhub `/quote` called |
| CoinGecko used for crypto (non-BITKUB) | Integration: crypto asset not on BITKUB → verify CoinGecko called |
| FX 60-min TTL | Unit test: call twice within 60 min → ExchangeRate-API called once |
| FX graceful degradation | Mock ExchangeRate-API 500 → verify cached rates returned with original `fetched_at` |
| `price_cache_fresh` view accuracy | SQL: insert stale row → query view → should not appear in fresh results |
| No price history stored | `grep` for historical price columns → zero results (only `fetched_at` on most recent) |
| `formatNumber` used everywhere | `grep /\.toFixed\(/` in components → zero hits |

---

## 5. Integration

### Key Library

| File | Responsibility |
|---|---|
| `lib/priceService.ts` | Three-tier price fetching with 15-min TTL cache; `getPrice(asset_id)`, `getPrices(asset_ids[])` |
| `lib/fxService.ts` | FX rates with 60-min TTL, ExchangeRate-API integration |
| `data/sector_taxonomy.json` | Static peer discovery fallback (50+ stocks, 8 sectors) |

### Consumed By (all read from `price_cache` and `fx_rates`)

| Component | How It Uses Prices / FX |
|---|---|
| **Component 2 — Portfolio Data Layer** | Drift calculation (`current_value = price × quantity`), holdings display, FX conversion |
| **Component 3 — Rebalancing Engine** | Order sizing (`estimated_value = price × quantity`), pre-flight balance validation |
| **Component 4 — Broker Integration** | Price cache updated during BITKUB sync, InnovestX equity prices via Finnhub, digital asset prices via CoinGecko |
| **Component 7 — Asset Discovery** | `PeerCard` price display, Top Movers gainer/loser calculations |
| **Component 6 — News Feed** | Indirectly via Finnhub news service (no price dependency) |

### External APIs Called

| Provider | Used By | Purpose |
|---|---|---|
| Alpaca API | Component 4 sync route | Crypto prices at sync time |
| BITKUB `/api/market/ticker` | Component 4 sync route | Crypto prices (Tier 1b) |
| Finnhub `/quote` | `priceService.ts` | Stock/ETF prices (Tier 2) |
| CoinGecko `/simple/price` | `priceService.ts` | Crypto prices (Tier 3) |
| ExchangeRate-API | `fxService.ts` | FX conversion rates |
| Finnhub `/stock/peers` | Component 7 discovery | Peer asset discovery |
| Finnhub `/news` | Component 6 news feed | News articles |
| FMP `/feed` | Component 6 news feed | News fallback |
