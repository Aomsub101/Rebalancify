# Rebalancify — Technical Architecture Documents

**Version:** 1.2
**Date:** March 2026
**Derived from:** PRD.md v1.3

---

## AGENT CONTEXT

This document contains five technical architecture specifications derived from PRD.md. They must remain internally consistent — table names in DOC-01 match endpoint payloads in DOC-02, component names in DOC-03 map to API calls in DOC-02, and build order in DOC-05 respects schema dependencies in DOC-01.

**Rule:** DOC-01 is the source of truth for all data structures. Any field name used in DOC-02, DOC-03, or DOC-05 that conflicts with DOC-01 is a bug — DOC-01 wins.

**Changes from v1.1:**
- DOC-01: `silos` table — `max 5 per user` constraint added at application layer
- DOC-01: `user_profiles` — Resend fields removed (Resend does not store state in DB); `schwab_token_expires` added
- DOC-01: `rebalance_orders` — `bitkub_order_id`, `innovestx_order_id`, `schwab_order_id`, `webull_order_id` columns added (all nullable, populated in v2.0)
- DOC-02: All silo sync endpoints updated to include InnovestX, Schwab, Webull in addition to Alpaca and BITKUB
- DOC-02: `/profile` PATCH updated — LLM provider now documents 6 options including 5 direct providers
- DOC-03: Settings page updated — all 5 broker sections + LLM section with free-tier labels
- DOC-04: ADR-007 updated — OpenRouter as optional gateway; direct providers documented
- DOC-05: Phase 3 updated — InnovestX, Schwab, Webull execution explicitly moved to Phase 10 (v2.0); Phase 2 now covers Alpaca execution + BITKUB/InnovestX/Schwab/Webull holdings fetch only

---

## DOC-01: Data Model & Database Schema

### 1. Design Principles

1. User data is never readable by other users — enforced at database layer via RLS.
2. Prices and news are cached globally to minimise free-tier API quota.
3. Rebalancing sessions are immutable append-only records.
4. Asset-to-ticker mappings stored once per user per silo and reused permanently.
5. All monetary values stored as `NUMERIC(20,8)` to avoid floating-point errors.
6. Historical price data is not stored. `price_cache` holds only the most recent price.
7. Maximum 5 active silos per user — enforced at application layer (not DB constraint) to allow soft deletion without breaking the limit.

---

### 2. Entity Relationship Summary

| Table | Domain | RLS Owner | Notes |
|---|---|---|---|
| `users` | Auth | `auth.uid()` | Managed by Supabase Auth |
| `user_profiles` | Auth | `user_id` | App settings, all encrypted API keys, LLM config |
| `silos` | Portfolio | `user_id` | Max 5 active per user (application-enforced) |
| `assets` | Portfolio | Global read | Canonical asset registry — shared |
| `asset_mappings` | Portfolio | `user_id` | Local label → canonical asset per silo |
| `holdings` | Holdings | via silo | Quantity + cost basis per asset per silo |
| `target_weights` | Holdings | via silo | User-defined target allocation percentages |
| `price_cache` | Prices | Global read | Most recent price per asset — TTL 15 min |
| `fx_rates` | Prices | Global read | USD exchange rates — TTL 60 min |
| `rebalance_sessions` | Rebalancing | via silo | Immutable session header |
| `rebalance_orders` | Rebalancing | via session | Each buy/sell order; broker order IDs for all platforms |
| `news_cache` | News | Global read | Articles cached per ticker — TTL 15 min |
| `user_article_state` | News | `user_id` | Per-user read/dismiss flags |
| `knowledge_chunks` | RAG (v2.0) | `user_id` | Embedded document chunks |
| `research_sessions` | RAG (v2.0) | `user_id` | Cached AI research per ticker |

---

### 3. Table Definitions

#### 3.1 user_profiles

```sql
CREATE TABLE user_profiles (
  id                    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name          TEXT,
  global_currency       CHAR(3)     NOT NULL DEFAULT 'USD',
  show_usd_toggle       BOOLEAN     NOT NULL DEFAULT FALSE,
  drift_notif_channel   TEXT        NOT NULL DEFAULT 'both', -- 'app' | 'email' | 'both'

  -- Alpaca
  alpaca_key_enc        TEXT,
  alpaca_secret_enc     TEXT,
  alpaca_mode           TEXT        NOT NULL DEFAULT 'paper', -- 'paper' | 'live'

  -- BITKUB
  bitkub_key_enc        TEXT,
  bitkub_secret_enc     TEXT,

  -- InnovestX (Settrade + Digital Assets)
  innovestx_key_enc     TEXT,
  innovestx_secret_enc  TEXT,

  -- Charles Schwab (OAuth — token stored, not key/secret)
  schwab_access_enc     TEXT,
  schwab_refresh_enc    TEXT,
  schwab_token_expires  TIMESTAMPTZ,

  -- Webull
  webull_key_enc        TEXT,
  webull_secret_enc     TEXT,

  -- LLM (v2.0)
  -- provider: 'openrouter' | 'google' | 'groq' | 'openai' | 'anthropic' | 'deepseek'
  llm_provider          TEXT,
  llm_key_enc           TEXT,
  llm_model             TEXT,
  -- model examples: 'gemini-2.0-flash' | 'llama-3.3-70b-versatile' | 'gpt-4o-mini'
  --                 'claude-3-5-haiku-20241022' | 'deepseek-chat' | 'openai/gpt-4o-mini' (openrouter format)

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_profiles_self ON user_profiles USING (id = auth.uid());
```

#### 3.2 silos

```sql
CREATE TABLE silos (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT         NOT NULL,
  platform_type    TEXT         NOT NULL,
  -- 'alpaca' | 'bitkub' | 'innovestx' | 'schwab' | 'webull' | 'manual'
  base_currency    CHAR(3)      NOT NULL DEFAULT 'USD',
  drift_threshold  NUMERIC(5,2) NOT NULL DEFAULT 5.0,
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
  -- Application layer checks: COUNT(is_active=TRUE) <= 5 per user before INSERT
  last_synced_at   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE silos ENABLE ROW LEVEL SECURITY;
CREATE POLICY silos_owner ON silos USING (user_id = auth.uid());
```

> **Silo limit enforcement:** Before inserting a new silo, the API checks `SELECT COUNT(*) FROM silos WHERE user_id = $1 AND is_active = TRUE`. If count >= 5, return HTTP 422 with code `SILO_LIMIT_REACHED`.

#### 3.3 assets (global)

```sql
CREATE TABLE assets (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker        TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  asset_type    TEXT    NOT NULL,  -- 'stock' | 'crypto' | 'etf'
  price_source  TEXT    NOT NULL,  -- 'finnhub' | 'coingecko' | 'alpaca' | 'bitkub'
  coingecko_id  TEXT,
  sector        TEXT,
  exchange      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX assets_ticker_source ON assets(ticker, price_source);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY assets_read ON assets FOR SELECT USING (TRUE);
```

#### 3.4 asset_mappings

```sql
CREATE TABLE asset_mappings (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  silo_id       UUID    NOT NULL REFERENCES silos(id) ON DELETE CASCADE,
  asset_id      UUID    NOT NULL REFERENCES assets(id),
  local_label   TEXT    NOT NULL,
  confirmed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(silo_id, asset_id)
);

ALTER TABLE asset_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY asset_mappings_owner ON asset_mappings
  USING (silo_id IN (SELECT id FROM silos WHERE user_id = auth.uid()));
```

#### 3.5 holdings

```sql
CREATE TABLE holdings (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  silo_id          UUID          NOT NULL REFERENCES silos(id) ON DELETE CASCADE,
  asset_id         UUID          NOT NULL REFERENCES assets(id),
  quantity         NUMERIC(20,8) NOT NULL DEFAULT 0,
  cost_basis       NUMERIC(20,8),
  cash_balance     NUMERIC(20,8) NOT NULL DEFAULT 0,
  last_updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  source           TEXT          NOT NULL DEFAULT 'manual',
  -- 'manual' | 'alpaca_sync' | 'bitkub_sync' | 'innovestx_sync' | 'schwab_sync' | 'webull_sync'
  UNIQUE(silo_id, asset_id)
);

ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY holdings_owner ON holdings
  USING (silo_id IN (SELECT id FROM silos WHERE user_id = auth.uid()));
```

> **Staleness warning:** UI shows "X days old" when `NOW() - last_updated_at > 7 days` for manual silos. API silos update `last_updated_at` on every sync.

#### 3.6 target_weights

```sql
CREATE TABLE target_weights (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  silo_id     UUID          NOT NULL REFERENCES silos(id) ON DELETE CASCADE,
  asset_id    UUID          NOT NULL REFERENCES assets(id),
  weight_pct  NUMERIC(6,3)  NOT NULL,
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(silo_id, asset_id)
);

ALTER TABLE target_weights ADD CONSTRAINT weight_range
  CHECK (weight_pct >= 0 AND weight_pct <= 100);

ALTER TABLE target_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY target_weights_owner ON target_weights
  USING (silo_id IN (SELECT id FROM silos WHERE user_id = auth.uid()));
```

> **Cash remainder rule:** Sum of `weight_pct` across a silo does not need to equal 100. Remainder = target cash allocation. Engine warns when sum ≠ 100 but does not block saving.

#### 3.7 price_cache (global, no history)

```sql
CREATE TABLE price_cache (
  asset_id    UUID          PRIMARY KEY REFERENCES assets(id),
  price       NUMERIC(20,8) NOT NULL,
  currency    CHAR(3)       NOT NULL,
  fetched_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  source      TEXT          NOT NULL   -- 'finnhub' | 'coingecko' | 'alpaca' | 'bitkub'
);

-- Helper view used by API to decide whether to re-fetch
CREATE VIEW price_cache_fresh AS
  SELECT *, (NOW() - fetched_at) < INTERVAL '15 minutes' AS is_fresh
  FROM price_cache;

ALTER TABLE price_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY price_cache_read ON price_cache FOR SELECT USING (TRUE);
```

#### 3.8 fx_rates (global)

```sql
CREATE TABLE fx_rates (
  currency      CHAR(3)       PRIMARY KEY,
  rate_to_usd   NUMERIC(20,8) NOT NULL,
  fetched_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE fx_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY fx_rates_read ON fx_rates FOR SELECT USING (TRUE);
```

#### 3.9 rebalance_sessions (immutable)

```sql
CREATE TABLE rebalance_sessions (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  silo_id          UUID          NOT NULL REFERENCES silos(id),
  user_id          UUID          NOT NULL REFERENCES auth.users(id),
  mode             TEXT          NOT NULL,  -- 'partial' | 'full'
  cash_included    BOOLEAN       NOT NULL DEFAULT FALSE,
  cash_amount      NUMERIC(20,8),
  weights_sum_pct  NUMERIC(6,3)  NOT NULL,
  cash_target_pct  NUMERIC(6,3)  NOT NULL,
  snapshot_before  JSONB         NOT NULL,
  -- Full state of holdings + prices + weights at calculation time
  snapshot_after   JSONB,
  -- Populated after execution for API silos; NULL for manual silos
  status           TEXT          NOT NULL DEFAULT 'pending',
  -- 'pending' | 'approved' | 'partial' | 'cancelled'
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  -- NEVER updated after creation
);

ALTER TABLE rebalance_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY rebal_sessions_owner ON rebalance_sessions
  USING (user_id = auth.uid());
```

#### 3.10 rebalance_orders

```sql
CREATE TABLE rebalance_orders (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID          NOT NULL REFERENCES rebalance_sessions(id),
  asset_id            UUID          NOT NULL REFERENCES assets(id),
  order_type          TEXT          NOT NULL,  -- 'buy' | 'sell'
  quantity            NUMERIC(20,8) NOT NULL,
  estimated_value     NUMERIC(20,8) NOT NULL,
  price_at_calc       NUMERIC(20,8) NOT NULL,
  weight_before_pct   NUMERIC(6,3)  NOT NULL,
  weight_after_pct    NUMERIC(6,3)  NOT NULL,
  execution_status    TEXT          NOT NULL DEFAULT 'pending',
  -- 'pending' | 'approved' | 'skipped' | 'executed' | 'failed' | 'manual'
  -- 'manual' = user executes on their platform (v1.0 for all non-Alpaca)
  alpaca_order_id     TEXT,         -- Populated when executed via Alpaca (v1.0)
  bitkub_order_id     TEXT,         -- Populated when executed via BITKUB (v2.0)
  innovestx_order_id  TEXT,         -- Populated when executed via InnovestX (v2.0)
  schwab_order_id     TEXT,         -- Populated when executed via Schwab (v2.0)
  webull_order_id     TEXT,         -- Populated when executed via Webull (v2.0)
  executed_at         TIMESTAMPTZ
);

ALTER TABLE rebalance_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY rebal_orders_owner ON rebalance_orders
  USING (session_id IN (
    SELECT id FROM rebalance_sessions WHERE user_id = auth.uid()
  ));
```

#### 3.11 news_cache (global)

```sql
CREATE TABLE news_cache (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id  TEXT        NOT NULL UNIQUE,
  source       TEXT        NOT NULL,  -- 'finnhub' | 'fmp'
  tickers      TEXT[]      NOT NULL,
  headline     TEXT        NOT NULL,
  summary      TEXT,
  url          TEXT        NOT NULL,
  published_at TIMESTAMPTZ,
  is_macro     BOOLEAN     NOT NULL DEFAULT FALSE,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX news_tickers_gin ON news_cache USING GIN (tickers);

ALTER TABLE news_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY news_cache_read ON news_cache FOR SELECT USING (TRUE);
```

#### 3.12 user_article_state

```sql
CREATE TABLE user_article_state (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id     UUID    NOT NULL REFERENCES news_cache(id) ON DELETE CASCADE,
  is_read        BOOLEAN NOT NULL DEFAULT FALSE,
  is_dismissed   BOOLEAN NOT NULL DEFAULT FALSE,
  interacted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, article_id)
);

ALTER TABLE user_article_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY article_state_owner ON user_article_state
  USING (user_id = auth.uid());
```

#### 3.13 knowledge_chunks (v2.0)

```sql
CREATE TABLE knowledge_chunks (
  id           UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id  UUID     NOT NULL,
  chunk_index  INTEGER  NOT NULL,
  content      TEXT     NOT NULL,
  embedding    vector(1536),
  -- Dimension matches OpenAI text-embedding-3-small and Google text-embedding-004 (768 padded to 1536)
  -- If provider uses different dimension, migration required
  metadata     JSONB,   -- { source, title, page, author, document_name }
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX knowledge_chunks_embedding_idx ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops);

ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY knowledge_chunks_owner ON knowledge_chunks
  USING (user_id = auth.uid());
```

#### 3.14 research_sessions (v2.0)

```sql
CREATE TABLE research_sessions (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker        TEXT    NOT NULL,
  asset_id      UUID    REFERENCES assets(id),
  llm_provider  TEXT    NOT NULL,
  llm_model     TEXT    NOT NULL,
  output        JSONB   NOT NULL,
  -- { sentiment: 'bullish'|'neutral'|'bearish', confidence: float,
  --   risk_factors: string[], summary: string, sources: string[] }
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  refreshed_at  TIMESTAMPTZ
);

ALTER TABLE research_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY research_sessions_owner ON research_sessions
  USING (user_id = auth.uid());
```

---

### 4. Auth Trigger

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

### 5. Derived Data (Never Stored)

| Derived Value | Computed From | Where Used |
|---|---|---|
| Current asset weight % | `holdings.quantity × price_cache.price ÷ silo total value` | Drift indicator, overview |
| Drift amount % | `current_weight_pct − target_weights.weight_pct` | Drift indicator, daily digest |
| Silo total value | `SUM(holdings.quantity × price_cache.price) + cash_balance` | Overview, rebalancing engine |
| Cash target % | `100 − SUM(target_weights.weight_pct)` | Rebalancing engine, weight editor |
| USD-converted silo value | `silo_total_value × fx_rates.rate_to_usd` | Global overview USD toggle |
| Holdings staleness (days) | `NOW() − holdings.last_updated_at` | Staleness warning — manual silos |
| Schwab token expired | `NOW() > user_profiles.schwab_token_expires` | Settings reconnect prompt |
| Active silo count | `COUNT(*) WHERE user_id = $1 AND is_active = TRUE` | Silo creation guard (max 5) |

---

## DOC-02: API Contract

### 1. Conventions

| Convention | Value |
|---|---|
| Base URL | `https://api.rebalancify.app/v1` |
| Auth header | `Authorization: Bearer <supabase_jwt>` |
| Content-Type | `application/json` |
| Date format | ISO 8601 |
| Monetary values | Strings with 8 decimal places — `"30.00000000"` |
| Percentages | Numeric with 3 decimal places — `30.000` |
| IDs | UUID v4 strings |
| Pagination | `?page=1&limit=20` |

### 2. Standard Error Response

```json
{
  "error": {
    "code": "SILO_LIMIT_REACHED",
    "message": "Maximum of 5 active silos reached",
    "detail": "Deactivate or delete an existing silo to create a new one."
  }
}
```

**Error codes relevant to silo limit:**
- `SILO_LIMIT_REACHED` — HTTP 422 — returned when user already has 5 active silos

### 3. Auth (Supabase Client SDK)

```
supabase.auth.signUp({ email, password })
supabase.auth.signInWithPassword({ email, password })
supabase.auth.resetPasswordForEmail(email)
supabase.auth.signOut()
```

### 4. Profile Endpoints

**GET /profile**
```json
{
  "id": "uuid",
  "display_name": "string",
  "global_currency": "USD",
  "show_usd_toggle": false,
  "drift_notif_channel": "both",
  "alpaca_mode": "paper",
  "alpaca_connected": true,
  "bitkub_connected": false,
  "innovestx_connected": false,
  "schwab_connected": false,
  "schwab_token_expired": false,
  "webull_connected": false,
  "llm_connected": true,
  "llm_provider": "google",
  "llm_model": "gemini-2.0-flash",
  "active_silo_count": 3,
  "silo_limit": 5,
  "created_at": "2026-03-01T00:00:00Z"
}
```

**PATCH /profile** — All fields optional. API keys accepted in plain text, encrypted server-side, never returned.
```json
{
  "display_name": "string",
  "show_usd_toggle": false,
  "drift_notif_channel": "app | email | both",
  "alpaca_key": "string",
  "alpaca_secret": "string",
  "alpaca_mode": "paper | live",
  "bitkub_key": "string",
  "bitkub_secret": "string",
  "innovestx_key": "string",
  "innovestx_secret": "string",
  "schwab_auth_code": "OAuth code exchanged server-side",
  "webull_key": "string",
  "webull_secret": "string",
  "llm_provider": "openrouter | google | groq | openai | anthropic | deepseek",
  "llm_key": "string",
  "llm_model": "string"
}
```

### 5. Silo Endpoints

**GET /silos** — Returns all silos with `total_value`, `weights_sum_pct`, `cash_target_pct`, `last_synced_at`.

**POST /silos**
```json
{
  "name": "string",
  "platform_type": "alpaca | bitkub | innovestx | schwab | webull | manual",
  "base_currency": "USD",
  "drift_threshold": 5.0
}
// Error 422 SILO_LIMIT_REACHED if user already has 5 active silos
```

**PATCH /silos/:silo_id** — Updates `name`, `base_currency`, `drift_threshold`.

**DELETE /silos/:silo_id** — Sets `is_active = FALSE` (soft delete). Cascades to holdings, weights, mappings, sessions only on hard delete (separate admin operation).

**POST /silos/:silo_id/sync** — Triggers fetch for the silo's platform.

For Alpaca: `GET /v2/positions` + `GET /v2/account`
For BITKUB: `POST /api/market/wallet` + `GET /api/market/ticker`
For InnovestX: `get_portfolio(account_no)` via Settrade SDK
For Schwab: `GET /accounts/{accountHash}?fields=positions` — returns 401 if token expired
For Webull: `GET /account/positions` + `GET /account/balance`

```json
// Response 200
{
  "synced_at": "2026-03-19T10:00:00Z",
  "holdings_updated": 5,
  "cash_balance": "500.00000000",
  "platform": "alpaca | bitkub | innovestx | schwab | webull"
}
// Error 422: platform_type = 'manual'
// Error 401: Schwab token expired — prompt re-auth
// Error 503: brokerage API unreachable
```

### 6. Holdings Endpoints

**GET /silos/:silo_id/holdings** — Returns `cash_balance` + holdings array with derived fields: `current_price`, `current_value`, `current_weight_pct`, `target_weight_pct`, `drift_pct`, `drift_breached`, `stale_days`.

**POST /silos/:silo_id/holdings** — Manual silos only.

**PATCH /silos/:silo_id/holdings/:holding_id** — Manual silos only. Updates `quantity`, `cost_basis`, `cash_balance`.

### 7. Asset Search & Mapping

**GET /assets/search?q=:query&type=stock|crypto** — Queries Finnhub (stock) or CoinGecko (crypto). Returns ranked candidates.

**POST /silos/:silo_id/asset-mappings** — Confirm asset match.
```json
// Request
{ "ticker": "AAPL", "name": "Apple Inc.", "asset_type": "stock", "price_source": "finnhub", "local_label": "apple" }
// Response 201: { asset_id, mapping_id, ticker }
```

### 8. Target Weights

**GET /silos/:silo_id/target-weights** — Returns weights + `weights_sum_pct` + `cash_target_pct` + `sum_warning`.

**PUT /silos/:silo_id/target-weights** — Atomic replacement. Validates 0 ≤ weight ≤ 100. Sum ≠ 100 is allowed (warning only).

### 9. Rebalancing Endpoints

**POST /silos/:silo_id/rebalance/calculate**
```json
// Request
{ "mode": "partial | full", "include_cash": false, "cash_amount": "500.00" }
// Response 200: session_id, orders[], balance_valid, balance_errors, snapshot_before
// Error 422: balance_valid = false
```

**POST /silos/:silo_id/rebalance/execute**
```json
// Request
{ "session_id": "uuid", "approved_order_ids": ["uuid"], "skipped_order_ids": ["uuid"] }
// For Alpaca silos: submits to Alpaca API
// For all other API silos (v1.0): marks orders as 'manual'
// For manual silos: marks orders as 'manual'
```

**GET /silos/:silo_id/rebalance/history** — Paginated session list for one silo.

**GET /rebalance/history** — Aggregate history across all silos. Includes `silo_name` per session.

### 10. News Endpoints

**GET /news/portfolio** — Portfolio news filtered to user's holdings.

**GET /news/macro** — General macro news.

**POST /news/refresh** — Force re-fetch bypassing TTL. Optional `tickers` array.

**PATCH /news/articles/:article_id/state** — Update `is_read` or `is_dismissed`.

### 11. Discovery Endpoints

**GET /assets/:asset_id/peers** — 5–8 peers via Finnhub `/stock/peers`; falls back to static taxonomy.

**GET /market/top-movers?type=stocks|crypto** — Top 5 gainers and losers.

**GET /silos/:silo_id/drift** — Current drift snapshot.

---

## DOC-03: Frontend Component Tree

### 1. Routing Structure

```
app/
├── (auth)/
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   └── reset-password/page.tsx
├── (dashboard)/
│   ├── layout.tsx                   ← AppShell
│   ├── overview/page.tsx
│   ├── silos/
│   │   ├── page.tsx
│   │   ├── new/page.tsx
│   │   └── [silo_id]/
│   │       ├── page.tsx
│   │       ├── rebalance/page.tsx
│   │       └── history/page.tsx
│   ├── news/page.tsx
│   ├── discover/page.tsx
│   ├── research/[ticker]/page.tsx   ← v2.0
│   └── settings/page.tsx
├── api/                             ← Next.js API routes
└── middleware.ts
```

### 2. Component Hierarchy

#### 2.1 AppShell
```
AppShell
├── Sidebar (NavItems + SiloCountBadge showing X/5)
├── TopBar
│   ├── USDToggle
│   └── UserMenu
└── <children />
```

#### 2.2 Overview Page
API: `GET /silos`, `GET /fx_rates`
```
OverviewPage
├── PortfolioSummaryCard (total value, silo count X/5, total assets)
├── SiloCardList
│   └── SiloCard ×n (name, total value, currency, drift status, platform badge)
├── GlobalDriftBanner (if any silo breached threshold)
└── TopMoversWidget (preview)
```

#### 2.3 Silo Detail Page
API: `GET /silos/:id/holdings`, `GET /silos/:id/target-weights`, `GET /silos/:id/drift`
```
SiloDetailPage
├── SiloHeader (name, currency, platform badge, Sync button for API silos)
├── SiloSummaryBar (total value, cash, weights sum warning)
├── HoldingsTable
│   └── HoldingRow ×n
│       ├── TickerCell
│       ├── QuantityCell (editable — manual silos)
│       ├── CurrentValueCell
│       ├── CurrentWeightCell (derived)
│       ├── TargetWeightCell (editable inline)
│       ├── DriftCell (green/yellow/red badge)
│       └── StalenessWarning (manual silos > 7 days)
├── CashBalanceRow (editable, shows cash_target_pct)
├── WeightsSumBar (warning if ≠ 100%)
├── AddAssetButton → AssetSearchModal
└── RebalanceButton → /silos/:id/rebalance
```

#### 2.4 AssetSearchModal
```
AssetSearchModal
├── TypeSelector (Stock/ETF | Crypto)
├── SearchInput (debounced → GET /assets/search)
├── SearchResultsList
│   └── SearchResultRow ×n → ConfirmButton
└── LoadingState / EmptyState
```

#### 2.5 Rebalance Page (3-step wizard)
```
RebalancePage
├── Step 1: RebalanceConfigPanel
│   ├── ModeSelector (partial | full)
│   ├── CashToggle
│   ├── CashAmountInput (if CashToggle on)
│   ├── WeightsSumWarning
│   └── CalculateButton → POST /rebalance/calculate
│
├── Step 2: OrderReviewPanel
│   ├── SessionSummaryBar
│   ├── FullRebalanceWarning (if mode='full')
│   ├── ExecutionModeNotice (if non-Alpaca: "You will execute these orders manually on [platform]")
│   ├── BalanceErrorBanner (if balance_valid=false)
│   ├── OrdersTable
│   │   └── OrderRow ×n (ticker, BUY/SELL, quantity, value, weight before→after, SkipCheckbox)
│   ├── ApproveAllButton
│   └── ExecuteButton → ConfirmDialog → POST /rebalance/execute
│
└── Step 3: ExecutionResultPanel
    ├── AlpacaOrders: OrderStatusList (executed | skipped | failed)
    ├── ManualOrders: ManualOrderInstructions ("Execute these orders on [platform]")
    └── BackToSiloButton
```

> **ExecutionModeNotice:** For non-Alpaca API silos in v1.0, a persistent banner on Step 2 reads: "These orders will not be submitted automatically. After reviewing, you will execute them manually on [Platform Name]."

#### 2.6 News Page
```
NewsPage
├── NewsTabs (Portfolio News | Macro News)
├── RefreshBar (last updated + Refresh button)
├── RateLimitBanner
├── ArticleList → ArticleCard ×n
│   (headline, ticker tags, published time, source link, read/dismiss controls)
└── PaginationControls
```

#### 2.7 Discover Page
```
DiscoverPage
├── TopMoversTabs (US Stocks | Crypto)
│   └── TopMoversTable (gainers + losers)
├── AssetPeerSearch
│   └── PeerResultsGrid → PeerCard ×n
│       (ticker, name, price, AiInsightTag if llm_connected)
└── PortfolioDriftSummary
    └── DriftSiloBlock ×n → DriftMiniRow ×n
```

#### 2.8 Settings Page
```
SettingsPage
├── ProfileSection (display name)
├── NotificationsSection (drift channel selector)
├── SiloUsageBar (showing X / 5 silos used)
│
├── BrokerSection — "Connected Platforms"
│   ├── AlpacaSection
│   │   ├── ConnectionStatus + AlpacaModeSelector (paper | live)
│   │   ├── ApiKeyInput + ApiSecretInput (masked, write-only)
│   │   └── SaveButton
│   ├── BitkubSection (key + secret)
│   ├── InnovestXSection (key + secret)
│   ├── SchwabSection
│   │   ├── ConnectionStatus + TokenExpiryWarning
│   │   ├── ConnectButton (OAuth redirect)
│   │   └── DisconnectButton
│   └── WebullSection (key + secret + $500 minimum note)
│
├── LLMSection (v2.0) — "AI Research Key"
│   ├── FreeTierNote: "Gemini 2.0 Flash (Google AI Studio), Llama 3.3 70B (Groq),
│   │                  and DeepSeek V3 are available at zero cost."
│   ├── ProviderSelector
│   │   - Google AI Studio (free tier available)
│   │   - Groq (free tier available)
│   │   - DeepSeek (free tier available)
│   │   - OpenAI (paid)
│   │   - Anthropic (paid)
│   │   - OpenRouter (paid, 400+ models)
│   ├── ModelSelector (filtered by provider)
│   ├── LLMKeyInput (masked, write-only)
│   └── SaveButton
│
└── DangerZone (Delete Account)
```

### 3. Shared Components

| Component | Used By | Description |
|---|---|---|
| `PriceDisplay` | HoldingRow, PeerCard, MoverRow | Formats NUMERIC(20,8) with currency symbol |
| `WeightBadge` | HoldingRow, TargetWeightCell | Coloured pill showing weight % |
| `DriftBadge` | DriftCell, DriftMiniRow | Green/yellow/red with drift_pct |
| `ConfirmDialog` | ExecuteButton, DeleteAccountButton | Non-dismissible modal requiring affirmative click |
| `StalenessTag` | HoldingRow | "X days old" for manual holdings |
| `PlatformBadge` | SiloCard, SiloHeader | Coloured badge per platform_type |
| `ExecutionModeTag` | SiloCard, OrderReviewPanel | "Auto" (Alpaca) or "Manual" (all others in v1.0) |
| `EmptyState` | All list components | Consistent placeholder + CTA |
| `ErrorBanner` | All pages | API error display |
| `OfflineBanner` | AppShell | Shown when navigator.onLine = false |
| `LoadingSkeleton` | All data-fetching components | Skeleton placeholders during load |

### 4. State Management

| Layer | Technology | What It Holds |
|---|---|---|
| Server state | React Query (TanStack Query) | All API responses — cached, invalidated on mutations |
| Global UI state | React Context (SessionContext) | Supabase session, user profile, USD toggle, silo count |
| Local UI state | useState / useReducer | Form inputs, modal state, wizard step |

**Cache invalidation rules:**
- After `POST /silos/:id/sync` → invalidate `['silos', id]`, `['holdings', id]`, `['profile']` (silo count)
- After `POST /silos` → invalidate `['silos']`, `['profile']` (silo count)
- After `DELETE /silos/:id` → invalidate `['silos']`, `['profile']`
- After `PUT /target-weights` → invalidate `['target-weights', id]`, `['silos', id]`
- After `PATCH /holdings` → invalidate `['holdings', id]`, `['silos', id]`
- After `POST /rebalance/execute` → invalidate `['holdings', id]`, `['sessions', id]`, `['silos', id]`
- After `PATCH /profile` → invalidate `['profile']`

---

## DOC-04: Architecture Decision Record

### ADR-001 Supabase as All-in-One Backend
**Status:** Accepted. PostgreSQL + Auth + pgvector in one free-tier service. Avoids three separate vendors.

### ADR-002 Next.js App Router as Full-Stack Framework
**Status:** Accepted. PWA support + SSR + API routes for key proxying. Vercel zero-config deployment.

### ADR-003 Supabase pgvector for RAG
**Status:** Accepted. Already in stack. Sufficient for 50–500 document corpus (≈30 MB). Zero additional vendor. v3.0 upgrade path: LightRAG + Qdrant for >10,000 documents.

### ADR-004 Immutable Rebalance Session Blocks
**Status:** Accepted. `snapshot_before` JSONB ensures history is self-consistent even when users make external trades. Sessions never updated after creation.

### ADR-005 User-Supplied LLM API Keys (BYOK)
**Status:** Accepted. Zero LLM cost to developer. Feature gated until key is set.

### ADR-006 Finnhub Peers + Static Fallback for Asset Discovery
**Status:** Accepted. Accurate peer data without LLM dependency. Static fallback for offline.

### ADR-007 LLM Provider Architecture — Direct Keys + Optional OpenRouter
**Status:** Accepted (revised)

**Decision:** Five direct provider keys are always supported. OpenRouter is an optional convenience gateway, never required.

**Direct providers:**

| Provider | Free Tier | Base URL | SDK |
|---|---|---|---|
| Google (Gemini) | Yes — AI Studio free | `https://generativelanguage.googleapis.com/v1beta/openai/` | OpenAI-compatible |
| Groq | Yes — generous free tier | `https://api.groq.com/openai/v1` | OpenAI-compatible |
| DeepSeek | Yes — free tier with limits | `https://api.deepseek.com` | OpenAI-compatible |
| OpenAI | No (paid) | Native | OpenAI SDK |
| Anthropic | No (paid) | Custom | Anthropic SDK (special handling) |
| OpenRouter | Some free models | `https://openrouter.ai/api/v1` | OpenAI-compatible |

**Backend routing logic:** Google, Groq, DeepSeek, OpenRouter, and OpenAI all use the OpenAI SDK with a changed `base_url`. Anthropic requires the Anthropic SDK with custom `anthropic-version` header — this is the only special case.

**Free-tier zero-cost path:** Users with Google AI Studio, Groq, or DeepSeek keys pay nothing to use the Research Hub.

### ADR-008 BITKUB Official REST API
**Status:** Accepted. Public REST API with HMAC-SHA256. Holdings fetch in v1.0. Execution deferred to v2.0 for stability.

### ADR-009 Silo Limit of 5
**Status:** Accepted. Enforced at application layer (not DB constraint) to allow soft deletion without breaking the limit. Returns HTTP 422 `SILO_LIMIT_REACHED` when exceeded. Sufficient for target persona (typically 2–4 platforms).

### ADR-010 Alpaca Execution in v1.0; All Other Brokers in v2.0
**Status:** Accepted. Alpaca has the most mature API, paper trading mode for safe testing, and was part of the original MVP. BITKUB, InnovestX, Schwab, and Webull all defer execution to v2.0, creating a clean "multi-platform execution release" story.

### ADR-011 Resend as Transactional Email Provider
**Status:** Accepted. 3,000 emails/month free. Native Next.js integration. Current industry best practice for Vercel-hosted apps. Simple API. Used for daily drift digest only.

### ADR-012 PDPA Compliance Posture
**Status:** Accepted. Hosted application implements formal data controller requirements — published privacy policy, data processing register, user data deletion mechanism, and data minimisation. Formal PDPC registration in Thailand will be completed if and when user base reaches a scale that triggers the requirement.

---

## DOC-05: Feature Build Order & Dependency Map

### Phase 0 — Foundation

| # | Task | Depends On | Produces |
|---|---|---|---|
| 0.1 | Supabase project: enable pgvector, pg_cron, RLS defaults | — | Live Supabase instance |
| 0.2 | Run all migrations from DOC-01 in dependency order | 0.1 | Full schema live |
| 0.3 | Auth trigger: auto-create user_profiles on signup | 0.2 | Auth-profile linkage |
| 0.4 | Next.js scaffold: App Router, Tailwind, Supabase client, React Query | — | Dev environment |
| 0.5 | Vercel deployment + environment variables | 0.4 | Deployment pipeline |
| 0.6 | Auth pages: login, signup, reset-password | 0.3, 0.4 | Working auth flow |
| 0.7 | Auth middleware: protect /dashboard routes | 0.6 | Route guard |
| 0.8 | AppShell: Sidebar, TopBar, SessionContext | 0.7 | Authenticated shell |

### Phase 1 — Silos & Holdings Core

| # | Task | Depends On | Produces |
|---|---|---|---|
| 1.1 | GET/PATCH /profile (no API key handling yet) | 0.2, 0.7 | Profile endpoints |
| 1.2 | Settings page: display name + notification channel | 1.1, 0.8 | Basic settings UI |
| 1.3 | GET/POST/PATCH/DELETE /silos (with 5-silo limit check on POST) | 0.2, 0.7 | Silo CRUD |
| 1.4 | Silos list page + Create silo form (all platform_type options) | 1.3, 0.8 | Silo UI |
| 1.5 | GET /assets/search (Finnhub + CoinGecko) | 0.7 | Asset search |
| 1.6 | POST /silos/:id/asset-mappings | 0.2, 1.5 | Asset mapping |
| 1.7 | Price fetch service: TTL check → Finnhub/CoinGecko → upsert price_cache | 0.2 | Price cache |
| 1.8 | GET /silos/:id/holdings with all derived fields | 0.2, 1.6, 1.7 | Holdings read |
| 1.9 | POST + PATCH holdings (manual entry, quantity edit) | 0.2, 1.6 | Holdings write |
| 1.10 | PUT /silos/:id/target-weights | 0.2, 1.6 | Weight save |
| 1.11 | Silo detail page: HoldingsTable, CashBalanceRow, WeightsSumBar, AssetSearchModal | 1.8–1.10, 0.8 | Core silo UI |
| 1.12 | Staleness warning (> 7 days, manual silos) | 1.11 | Data freshness UX |

### Phase 2 — Alpaca Integration (Fetch + Execution)

| # | Task | Depends On | Produces |
|---|---|---|---|
| 2.1 | PATCH /profile: Alpaca key/secret encryption | 1.1 | Secure key storage |
| 2.2 | Settings page: Alpaca section (key inputs, paper/live mode, status) | 2.1, 1.2 | Alpaca setup UI |
| 2.3 | POST /silos/:id/sync for Alpaca: fetch positions + account | 2.1, 1.9 | Alpaca sync |
| 2.4 | POST /rebalance/calculate: partial + full mode, cash toggle, validation | 1.7, 1.8, 1.10 | Calculation endpoint |
| 2.5 | POST /rebalance/execute for Alpaca: submit orders to Alpaca API | 2.4, 2.3 | Alpaca execution |
| 2.6 | GET /rebalance/history (silo + aggregate) | 0.2 | History endpoints |
| 2.7 | Rebalancing page: 3-step wizard | 2.4, 2.5, 0.8 | Full rebalancing UI |
| 2.8 | Rebalance history page | 2.6, 0.8 | History UI |
| 2.9 | Silo detail: Sync button for Alpaca, last_synced_at | 2.3, 1.11 | Sync UI |

### Phase 3 — Non-Alpaca Holdings Fetch (BITKUB, InnovestX, Schwab, Webull)

| # | Task | Depends On | Produces |
|---|---|---|---|
| 3.1 | PATCH /profile: BITKUB + InnovestX + Schwab + Webull key storage | 2.1 | Multi-broker key storage |
| 3.2 | POST /silos/:id/sync for BITKUB (wallet + ticker) | 3.1, 1.9 | BITKUB sync |
| 3.3 | Price cache update from BITKUB ticker data | 3.2, 1.7 | BITKUB prices |
| 3.4 | POST /silos/:id/sync for InnovestX (Settrade SDK + digital assets) | 3.1, 1.9 | InnovestX sync |
| 3.5 | Schwab OAuth flow: connect, token storage, refresh, expiry detection | 3.1, 1.1 | Schwab auth |
| 3.6 | POST /silos/:id/sync for Schwab (accounts endpoint) | 3.5, 1.9 | Schwab sync |
| 3.7 | POST /silos/:id/sync for Webull (positions + balance) | 3.1, 1.9 | Webull sync |
| 3.8 | Settings page: BITKUB, InnovestX, Schwab (OAuth), Webull sections | 3.1–3.7, 1.2 | Full broker settings |
| 3.9 | Rebalancing: ExecutionModeNotice for non-Alpaca silos ("Manual" badge) | 2.7 | Execution UX clarity |

### Phase 4 — Drift & Overview

| # | Task | Depends On | Produces |
|---|---|---|---|
| 4.1 | GET /silos/:id/drift (snapshot computation) | 1.7, 1.8, 1.10 | Drift endpoint |
| 4.2 | DriftBadge component (green/yellow/red) | — | Reusable component |
| 4.3 | DriftCell in HoldingsTable | 4.1, 4.2, 1.11 | Drift in silo UI |
| 4.4 | GET /fx_rates (ExchangeRate-API, 60-min TTL) | 0.2 | FX endpoint |
| 4.5 | Overview page: SiloCardList, GlobalDriftBanner, USD toggle, SiloCountBadge | 4.1, 4.4, 0.8 | Overview UI |
| 4.6 | pg_cron daily drift digest: check thresholds, write in-app notifications, send email via Resend | 4.1, Resend setup | Drift alert delivery |

### Phase 5 — News Feed

| # | Task | Depends On | Produces |
|---|---|---|---|
| 5.1 | News fetch service: Finnhub + FMP, upsert news_cache, rate limit handling | 0.2 | News cache service |
| 5.2 | GET /news/portfolio (two-tier ticker matching) | 5.1, 1.8 | Portfolio news |
| 5.3 | GET /news/macro | 5.1 | Macro news |
| 5.4 | POST /news/refresh | 5.1 | Manual refresh |
| 5.5 | PATCH /news/articles/:id/state | 0.2 | Article state |
| 5.6 | News page: tabs, ArticleList, RefreshBar, RateLimitBanner, ArticleCard | 5.2–5.5, 0.8 | Full news UI |
| 5.7 | pg_cron: purge news_cache rows older than 24 hours | 0.2 | Storage management |

### Phase 6 — Asset Discovery

| # | Task | Depends On | Produces |
|---|---|---|---|
| 6.1 | GET /assets/:id/peers (Finnhub peers + static fallback) | 0.2, 1.7 | Peers endpoint |
| 6.2 | GET /market/top-movers (Finnhub/FMP stocks + CoinGecko crypto) | 1.7 | Top movers |
| 6.3 | Discover page: TopMoversTabs, AssetPeerSearch, PeerCard, PortfolioDriftSummary | 6.1, 6.2, 4.1, 0.8 | Discovery UI |

### Phase 7 — PWA & Polish

| # | Task | Depends On | Produces |
|---|---|---|---|
| 7.1 | next-pwa: service worker, manifest.json | All phases | PWA support |
| 7.2 | Offline detection: OfflineBanner, disable live features gracefully | 7.1 | Offline UX |
| 7.3 | LoadingSkeleton for all data-fetching components | All UI | Loading UX |
| 7.4 | ErrorBanner global handler | All UI | Error UX |
| 7.5 | Performance audit: calc < 2s, news < 3s, first load < 3s | 7.1 | Targets met |

### Phase 8 — AI Research Hub (v2.0)

| # | Task | Depends On | Produces |
|---|---|---|---|
| 8.1 | knowledge_chunks + research_sessions migrations | 0.2 | v2.0 tables |
| 8.2 | PATCH /profile: LLM provider + key + model (6 providers) | 2.1 | LLM key storage |
| 8.3 | Settings page: LLM section with free-tier labels and provider selector | 8.2, 1.2 | LLM settings UI |
| 8.4 | Document ingest pipeline: upload → semantic chunk → embed → store | 8.1, 8.2 | RAG ingest |
| 8.5 | POST /research/:ticker: pgvector similarity + LLM inference routing | 8.2, 8.4, 1.5 | Research endpoint |
| 8.6 | Research page: trigger, structured cards, disclaimer, cache display | 8.5, 0.8 | Research UI |
| 8.7 | GET /assets/:id/peers: populate ai_insight if llm_connected | 8.2, 6.1 | AI-enriched peers |
| 8.8 | Default /knowledge .md files shipped with repository | — | Default RAG corpus |

### Phase 9 — Multi-Platform Execution (v2.0)

| # | Task | Depends On | Produces |
|---|---|---|---|
| 9.1 | POST /rebalance/execute for BITKUB: place-bid/place-ask endpoints | 3.2, 2.4 | BITKUB execution |
| 9.2 | POST /rebalance/execute for InnovestX: Settrade order placement | 3.4, 2.4 | InnovestX execution |
| 9.3 | POST /rebalance/execute for Schwab: order placement endpoint | 3.6, 2.4 | Schwab execution |
| 9.4 | POST /rebalance/execute for Webull: order placement endpoint | 3.7, 2.4 | Webull execution |
| 9.5 | Update ExecutionResultPanel: remove "Manual" badge for newly automated platforms | 9.1–9.4, 2.7 | Execution UX updated |
| 9.6 | Update Settings page: remove manual-only notices for newly automated platforms | 9.1–9.4, 3.8 | Settings UX updated |

---

### Build Order Summary

**v1.0 MVP — Phases 0–7:**
Foundation → Silos & Holdings → Alpaca (Fetch + Execution) → Non-Alpaca Holdings Fetch → Drift & Overview → News → Discovery → PWA & Polish

**v2.0 — Phases 8–9:**
AI Research Hub → Multi-Platform Execution (BITKUB, InnovestX, Schwab, Webull)

**Hard dependency rules:**
- Phase 2 (Alpaca execution) must complete before Phase 9 (multi-platform execution) — Phase 9 reuses the execute endpoint pattern
- Phase 3 (non-Alpaca fetch) must complete before Phase 9 (non-Alpaca execution) — sync must work before execution
- Phase 8 (RAG + LLM key storage) must complete before Phase 9 is started — both are v2.0 and share the encrypted key infrastructure
- Never start Phase 8 without Phase 0.2 (all migrations) and Phase 2.1 (key encryption pattern) complete
