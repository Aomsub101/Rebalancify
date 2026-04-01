# Component 5 — Market Data & Pricing: As-Built PRD

## 1. Concept & Vision

Market Data & Pricing is the cross-cutting price infrastructure for the entire application. Every component that needs a current price — drift calculation, rebalancing, broker sync, news, discovery — calls through this layer. It implements a two-tier price-fetching strategy (cache-first, then external APIs) and a separate FX rates service, both with aggressive TTL-based caching to minimise external API calls and respect rate limits.

---

## 2. What Was Built

### Price Service (`lib/priceService.ts`)

`fetchPrice(supabase, assetId, ticker, source, coingeckoId?)` implements a two-tier strategy:

**Tier 1 — Cache check:** Query `price_cache_fresh` view for `asset_id`. If `is_fresh = true`, return cached price immediately. No external API call.

**Tier 2 — External fetch:**
- If `source === 'finnhub'` (or `'alpaca'` → Finnhub): `GET https://finnhub.io/api/v1/quote?symbol=<ticker>` → `json.c` (current price)
- If `source === 'coingecko'` (or `'bitkub'` → CoinGecko): `GET https://api.coingecko.com/api/v3/simple/price?ids=<id>&vs_currencies=usd` → `json[id].usd`
- If `source === 'alpaca'`: route through Finnhub (Alpaca does not provide a standalone price endpoint)
- If `source === 'bitkub'`: route through CoinGecko with `price_source = 'bitkub'`

**Tier 3 — Cache write:** After a successful external fetch, upsert into `price_cache`.

**Response shape:**
```typescript
{ price: string; currency: string; source: string; fromCache: boolean }
// e.g. { price: "185.20000000", currency: "USD", source: "finnhub", fromCache: true }
```

### FX Rates Service (`lib/fxRates.ts` + `app/api/fx-rates/route.ts`)

`parseExchangeRates(data)` and `rateToUsd(currency, rates)` in `lib/fxRates.ts` handle the ExchangeRate-API v6 response format. The API route at `GET /api/fx-rates` implements:

1. Check `fx_rates` table for `fetched_at` within 60 minutes → return cached rates
2. On stale: fetch `https://api.exchangerate-api.com/v6/latest/USD`
3. Parse `conversion_rates` (which express "1 USD = X currency")
4. Invert to compute `rate_to_usd = 1 / conversion_rate`
5. Upsert into `fx_rates` table
6. On API failure: return stale cached rates with original `fetched_at`

### price_cache Table (`supabase/migrations/08_price_cache.sql`)

```sql
CREATE TABLE price_cache (
  asset_id    UUID PRIMARY KEY REFERENCES assets(id),
  price       NUMERIC(20,8) NOT NULL,
  currency    CHAR(3) NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source      TEXT NOT NULL
)
-- Allowed source values: 'finnhub' | 'coingecko' | 'alpaca' | 'bitkub'
```

**`price_cache_fresh` view:**
```sql
CREATE VIEW price_cache_fresh AS
  SELECT *, (NOW() - fetched_at) < INTERVAL '15 minutes' AS is_fresh
  FROM price_cache
```

**RLS:** Read-all (`SELECT USING (TRUE)`). Writes are service-role only.

### fx_rates Table (`supabase/migrations/09_fx_rates.sql`)

```sql
CREATE TABLE fx_rates (
  currency    CHAR(3) PRIMARY KEY,
  rate_to_usd NUMERIC(20,8) NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

**RLS:** Read-all. Writes are service-role only.

### sector_taxonomy.json

A static JSON file at the project root mapping 8 sectors to representative tickers. Used as the peer discovery fallback when Finnhub's `/stock/peers` endpoint is unavailable. Contains 110 tickers across: Technology, Finance, Healthcare, ConsumerDiscretionary, ConsumerStaples, Energy, Industrials, Utilities, Materials, RealEstate, CommunicationServices, Crypto.

### Top Movers (`app/api/market/top-movers/route.ts`)

`GET /api/market/top-movers?type=stocks|crypto` returns top 5 gainers and top 5 losers.

**For stocks:**
- Primary: FMP `/gainers` + `/losers`
- Fallback: Finnhub `/scan/technical-indicator` (sort=percent_change_desc/asc)
- Final fallback: stale `price_cache` with `change_pct = 0`

**For crypto:**
- CoinGecko `/coins/markets` sorted by `price_change_percentage_24h_desc/asc`

**Response shape:**
```json
{
  "type": "stocks",
  "stale": false,
  "fetched_at": "2026-04-01T12:00:00.000Z",
  "gainers": [{ "ticker": "AAPL", "name": "Apple", "price": "185.20000000", "change_pct": 4.2 }],
  "losers": [{ "ticker": "TSLA", "name": "Tesla", "price": "180.00000000", "change_pct": -3.1 }]
}
```

---

## 3. Data Shapes

### Price Cache Row
| Column | Type | Notes |
|---|---|---|
| `asset_id` | uuid PK FK | One row per asset |
| `price` | NUMERIC(20,8) | 8 decimal places, always USD |
| `currency` | CHAR(3) | Always `'USD'` in current implementation |
| `fetched_at` | timestamptz | Used for TTL check via `price_cache_fresh` |
| `source` | text | Which API was used (finnhub/coingecko/alpaca/bitkub) |

### FX Rate Row
| Column | Type | Notes |
|---|---|---|
| `currency` | CHAR(3) PK | ISO 4217 code, e.g. `'THB'` |
| `rate_to_usd` | NUMERIC(20,8) | 1 unit of currency = this many USD |
| `fetched_at` | timestamptz | Used for 60-min TTL check |

---

## 4. Stories

| Story | Sub-components |
|---|---|
| STORY-017 / STORY-018 | `01-price_service.md`, `03-price_cache_table.md` |
| STORY-019 | `02-fx_rates_service.md`, `04-fx_rates_table.md` |
| STORY-024 / STORY-025 | `05-sector_taxonomy.md`, `06-top_movers.md` |
