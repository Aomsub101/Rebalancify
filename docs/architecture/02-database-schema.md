# docs/architecture/02-database-schema.md — Database Schema

## AGENT CONTEXT

**What this file is:** The authoritative source of truth for all database tables, columns, constraints, RLS policies, and derived data. Table names here are canonical — all API payloads and components must match.
**Derived from:** TECH_DOCS_v1.2.md (DOC-01 Data Model)
**Connected to:** docs/architecture/03-api-contract.md (field names must match), docs/architecture/05-build-order.md (migration order), stories/EPIC-01-foundation/STORY-001.md
**Critical rules for agents using this file:**
- This file wins all naming conflicts. If the API contract uses a field name that differs from a column name here, fix the API contract.
- All monetary values: `NUMERIC(20,8)`. All weight percentages: `NUMERIC(6,3)`. No exceptions.
- All user-data tables must have RLS enabled. Every policy must be verified per story.
- v2.0 tables (knowledge_chunks, research_sessions) are migrated in Phase 0 alongside all other tables.
- **TECH_DOCS_v1_2.md divergence (known, intentional):** This schema file is the authoritative source. TECH_DOCS_v1_2.md is missing three additions made after v1.2 was finalised: (1) the `onboarded BOOLEAN NOT NULL DEFAULT FALSE` column on `user_profiles`, (2) the entire `notifications` table, and (3) the `progress_banner_dismissed BOOLEAN NOT NULL DEFAULT FALSE` column on `user_profiles`. Do not consult TECH_DOCS_v1_2.md for these three items — use this file. TECH_DOCS_v1_2.md is read-only context; this file wins.

---

## Design Principles

1. User data is never readable by other users — enforced at the database layer via RLS.
2. Prices and news are cached globally to minimise free-tier API quota consumption.
3. Rebalancing sessions are immutable append-only records.
4. Asset-to-ticker mappings are stored once per user per silo and reused permanently.
5. All monetary values stored as `NUMERIC(20,8)` to avoid floating-point errors.
6. Historical price data is not stored. `price_cache` holds only the most recent price per asset.
7. Maximum 5 active silos per user — enforced at application layer (not DB constraint).

---

## Migration Run Order

Run migrations in this exact order to respect foreign key dependencies:

```
01_users_trigger.sql          ← auth.users trigger (Supabase managed)
02_user_profiles.sql          ← depends on auth.users
03_assets.sql                 ← global, no user dependency
04_silos.sql                  ← depends on auth.users
05_asset_mappings.sql         ← depends on silos, assets
06_holdings.sql               ← depends on silos, assets
07_target_weights.sql         ← depends on silos, assets
08_price_cache.sql            ← depends on assets
09_fx_rates.sql               ← no dependencies
10_rebalance_sessions.sql     ← depends on silos, auth.users
11_rebalance_orders.sql       ← depends on rebalance_sessions, assets
12_news_cache.sql             ← no dependencies
13_user_article_state.sql     ← depends on auth.users, news_cache
14_knowledge_chunks.sql       ← depends on auth.users (v2.0 table — migrate with all others)
15_research_sessions.sql      ← depends on auth.users, assets (v2.0 table)
16_notifications.sql          ← depends on auth.users, silos
17_pg_cron_drift_digest.sql   ← pg_cron job: daily at 08:00 UTC, checks drift thresholds, inserts in-app notifications ONLY. Email is sent separately by the Vercel Cron Job at app/api/cron/drift-digest/route.ts (see ADR-013).
18_pg_cron_news_purge.sql     ← pg_cron job: daily at 02:00 UTC, deletes news_cache rows older than 24 hours
```

---

## Table Definitions

### user_profiles

```sql
CREATE TABLE user_profiles (
  id                    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name          TEXT,
  global_currency       CHAR(3)     NOT NULL DEFAULT 'USD',
  -- The default base_currency pre-populated when the user creates a new silo.
  -- Does not affect rebalancing calculations or the USD display toggle.
  -- Silos always use their own base_currency for all calculations.
  -- The user sets this in Settings → Display → Default silo currency.
  show_usd_toggle       BOOLEAN     NOT NULL DEFAULT FALSE,
  drift_notif_channel   TEXT        NOT NULL DEFAULT 'both',
  -- Allowed values: 'app' | 'email' | 'both'

  -- Alpaca
  alpaca_key_enc        TEXT,
  alpaca_secret_enc     TEXT,
  alpaca_mode           TEXT        NOT NULL DEFAULT 'paper',
  -- Allowed values: 'paper' | 'live'

  -- BITKUB
  bitkub_key_enc        TEXT,
  bitkub_secret_enc     TEXT,

  -- InnovestX — Equity sub-account (Settrade Open API: OAuth Bearer)
  innovestx_key_enc           TEXT,   -- Settrade App ID
  innovestx_secret_enc        TEXT,   -- Settrade App Secret
  -- InnovestX — Digital Asset sub-account (proprietary HMAC-SHA256 API)
  innovestx_digital_key_enc   TEXT,   -- Digital Asset API Key
  innovestx_digital_secret_enc TEXT,  -- Digital Asset API Secret

  -- Charles Schwab (OAuth — token stored, not key/secret)
  schwab_access_enc     TEXT,
  schwab_refresh_enc    TEXT,
  schwab_token_expires  TIMESTAMPTZ,

  -- Webull
  webull_key_enc        TEXT,
  webull_secret_enc     TEXT,

  -- LLM (v2.0)
  -- provider allowed values: 'openrouter' | 'google' | 'groq' | 'openai' | 'anthropic' | 'deepseek'
  llm_provider          TEXT,
  llm_key_enc           TEXT,
  llm_model             TEXT,
  -- model examples: 'gemini-2.0-flash' | 'llama-3.3-70b-versatile' | 'gpt-4o-mini'
  --                 'claude-3-5-haiku-20241022' | 'deepseek-chat'

  onboarded             BOOLEAN     NOT NULL DEFAULT FALSE,
  progress_banner_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  -- TRUE after the user explicitly dismisses the post-onboarding progress banner.
  -- Set via PATCH /api/profile. Persists across devices (not localStorage).
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_profiles_self ON user_profiles
  USING (id = auth.uid());
```

**RLS note:** Users can only read and write their own profile row.

---

### silos

```sql
CREATE TABLE silos (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             TEXT         NOT NULL,
  platform_type    TEXT         NOT NULL,
  -- Allowed values: 'alpaca' | 'bitkub' | 'innovestx' | 'schwab' | 'webull' | 'manual'
  base_currency    CHAR(3)      NOT NULL DEFAULT 'USD',
  drift_threshold  NUMERIC(5,2) NOT NULL DEFAULT 5.0,
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
  last_synced_at   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE silos ENABLE ROW LEVEL SECURITY;
CREATE POLICY silos_owner ON silos
  USING (user_id = auth.uid());
```

**Silo limit enforcement (application layer):**
```sql
-- Run this check before INSERT:
SELECT COUNT(*) FROM silos WHERE user_id = $1 AND is_active = TRUE;
-- If count >= 5: return HTTP 422 SILO_LIMIT_REACHED
```

**Soft delete:** `DELETE /silos/:id` sets `is_active = FALSE`. Data is preserved. Hard delete is a separate admin operation.

---

### assets (global read-only registry)

```sql
CREATE TABLE assets (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker        TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  asset_type    TEXT    NOT NULL,
  -- Allowed values: 'stock' | 'crypto' | 'etf'
  price_source  TEXT    NOT NULL,
  -- Allowed values: 'finnhub' | 'coingecko' | 'alpaca' | 'bitkub'
  coingecko_id  TEXT,
  sector        TEXT,
  exchange      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX assets_ticker_source ON assets(ticker, price_source);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY assets_read ON assets FOR SELECT USING (TRUE);
```

---

### asset_mappings

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

---

### holdings

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
  -- Allowed values: 'manual' | 'alpaca_sync' | 'bitkub_sync' | 'innovestx_sync' | 'schwab_sync' | 'webull_sync'
  UNIQUE(silo_id, asset_id)
);

ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY holdings_owner ON holdings
  USING (silo_id IN (SELECT id FROM silos WHERE user_id = auth.uid()));
```

**Staleness warning:** UI shows "X days old" inline in `HoldingRow` when `NOW() - last_updated_at > 7 days` for manual silos. API silos update `last_updated_at` on every sync.

---

### target_weights

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

**Cash remainder rule:** Sum of `weight_pct` across a silo does not need to equal 100. Remainder = target cash allocation. Engine warns when sum ≠ 100 but does not block saving.

---

### price_cache (global, single row per asset — no history)

```sql
CREATE TABLE price_cache (
  asset_id    UUID          PRIMARY KEY REFERENCES assets(id),
  price       NUMERIC(20,8) NOT NULL,
  currency    CHAR(3)       NOT NULL,
  fetched_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  source      TEXT          NOT NULL
  -- Allowed values: 'finnhub' | 'coingecko' | 'alpaca' | 'bitkub'
);

CREATE VIEW price_cache_fresh AS
  SELECT *, (NOW() - fetched_at) < INTERVAL '15 minutes' AS is_fresh
  FROM price_cache;

ALTER TABLE price_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY price_cache_read ON price_cache FOR SELECT USING (TRUE);
```

---

### fx_rates (global)

```sql
CREATE TABLE fx_rates (
  currency      CHAR(3)       PRIMARY KEY,
  rate_to_usd   NUMERIC(20,8) NOT NULL,
  fetched_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE fx_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY fx_rates_read ON fx_rates FOR SELECT USING (TRUE);
```

**Cache TTL:** 60 minutes. The `GET /api/fx-rates` route checks `NOW() - fetched_at < INTERVAL '60 minutes'` before calling ExchangeRate-API.

---

### rebalance_sessions (immutable — never updated after creation)

```sql
CREATE TABLE rebalance_sessions (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  silo_id          UUID          NOT NULL REFERENCES silos(id),
  user_id          UUID          NOT NULL REFERENCES auth.users(id),
  mode             TEXT          NOT NULL,
  -- Allowed values: 'partial' | 'full'
  cash_included    BOOLEAN       NOT NULL DEFAULT FALSE,
  cash_amount      NUMERIC(20,8),
  weights_sum_pct  NUMERIC(6,3)  NOT NULL,
  cash_target_pct  NUMERIC(6,3)  NOT NULL,
  snapshot_before  JSONB         NOT NULL,
  -- Full state of holdings + prices + weights at calculation time
  -- Schema: { holdings: [...], prices: {...}, weights: {...}, total_value: "string" }
  snapshot_after   JSONB,
  -- Populated after execution for API silos; NULL for manual silos
  status           TEXT          NOT NULL DEFAULT 'pending',
  -- Allowed values: 'pending' | 'approved' | 'partial' | 'cancelled'
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  -- NEVER add an updated_at column — sessions are immutable
);

ALTER TABLE rebalance_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY rebal_sessions_owner ON rebalance_sessions
  USING (user_id = auth.uid());
```

**rebalance_sessions.status — State Machine**

| Status | Set By | Trigger Condition |
|---|---|---|
| `'pending'` | `POST /rebalance/calculate` | Session created; orders computed but not yet approved by user |
| `'approved'` | `POST /rebalance/execute` | All non-skipped orders submitted or marked manual; zero failed |
| `'partial'` | `POST /rebalance/execute` | At least one order executed/manual AND at least one order failed |
| `'cancelled'` | `POST /rebalance/execute` | User skipped ALL orders (approved_order_ids is empty) |

**Transition rules:**
- Only `POST /rebalance/execute` updates `rebalance_sessions.status`. The calculate endpoint always sets `'pending'`.
- `'partial'` takes priority over `'approved'` if any order has `execution_status = 'failed'`.
- `status` and `snapshot_after` are the only columns on `rebalance_sessions` ever updated after creation (see CLAUDE.md Rule 9 exception).

---

### rebalance_orders

```sql
CREATE TABLE rebalance_orders (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID          NOT NULL REFERENCES rebalance_sessions(id),
  asset_id            UUID          NOT NULL REFERENCES assets(id),
  order_type          TEXT          NOT NULL,
  -- Allowed values: 'buy' | 'sell'
  quantity            NUMERIC(20,8) NOT NULL,
  estimated_value     NUMERIC(20,8) NOT NULL,
  price_at_calc       NUMERIC(20,8) NOT NULL,
  weight_before_pct   NUMERIC(6,3)  NOT NULL,
  weight_after_pct    NUMERIC(6,3)  NOT NULL,
  execution_status    TEXT          NOT NULL DEFAULT 'pending',
  -- Allowed values: 'pending' | 'skipped' | 'executed' | 'failed' | 'manual'
  -- 'pending'  = calculated, not yet submitted to the user for approval
  -- 'skipped'  = user checked the skip box in Step 2 of the wizard
  -- 'executed' = submitted to Alpaca and confirmed (v1.0 Alpaca only)
  -- 'failed'   = submitted to Alpaca but Alpaca returned an error
  -- 'manual'   = user must execute on their platform (all non-Alpaca silos in v1.0)
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

---

### news_cache (global)

```sql
CREATE TABLE news_cache (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id  TEXT        NOT NULL UNIQUE,
  source       TEXT        NOT NULL,
  -- Allowed values: 'finnhub' | 'fmp'
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

**Cache TTL:** 24 hours. The `pg_cron` job in migration 18 (`18_pg_cron_news_purge.sql`) deletes all `news_cache` rows where `fetched_at < NOW() - INTERVAL '24 hours'`, running daily at 02:00 UTC. The news fetch service does NOT use a 15-minute TTL — that TTL applies only to `price_cache`. Do not conflate the two.

---

### user_article_state

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

---

### notifications

```sql
CREATE TABLE notifications (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL DEFAULT 'drift_breach',
  -- Allowed values: 'drift_breach' | 'schwab_token_expiring'
  -- 'drift_breach': an asset's drift has exceeded its configured threshold
  -- 'schwab_token_expiring': Schwab refresh token expires within 2 days — user must reconnect
  message      TEXT        NOT NULL,
  silo_id      UUID        REFERENCES silos(id) ON DELETE SET NULL,
  asset_ticker TEXT,
  is_read      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_owner ON notifications
  USING (user_id = auth.uid());
```

**Derived field (not stored):** `notification_count` — computed as `COUNT(*) WHERE user_id = auth.uid() AND is_read = FALSE`, returned in `GET /api/profile` response.

---

### knowledge_chunks (v2.0 — migrated in Phase 0)

```sql
CREATE TABLE knowledge_chunks (
  id           UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id  UUID     NOT NULL,
  chunk_index  INTEGER  NOT NULL,
  content      TEXT     NOT NULL,
  embedding    vector(1536),
  -- Dimension matches OpenAI text-embedding-3-small and Google text-embedding-004
  -- If provider uses different dimension, a migration is required before use
  metadata     JSONB,
  -- Schema: { source: string, title: string, page: int, author: string, document_name: string }
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX knowledge_chunks_embedding_idx ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops);

ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY knowledge_chunks_owner ON knowledge_chunks
  USING (user_id = auth.uid());
```

---

### research_sessions (v2.0 — migrated in Phase 0)

```sql
CREATE TABLE research_sessions (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker        TEXT    NOT NULL,
  asset_id      UUID    REFERENCES assets(id),
  llm_provider  TEXT    NOT NULL,
  llm_model     TEXT    NOT NULL,
  output        JSONB   NOT NULL,
  -- Schema: { sentiment: string, confidence: float, risk_factors: string[], summary: string, sources: string[] }
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  refreshed_at  TIMESTAMPTZ,
  metadata      JSONB
  -- Schema: { source: 'manual_search' | 'portfolio_holding', trigger_page: string }
  -- source: how the research session was triggered (F3-R1)
  -- trigger_page: the page the user was on when they triggered it (e.g. 'discover', 'silo_detail')
);

ALTER TABLE research_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY research_sessions_owner ON research_sessions
  USING (user_id = auth.uid());
```

---

## Auth Trigger

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

## Derived Values (Never Stored)

| Derived Value | Formula | Where Computed |
|---|---|---|
| Current asset weight % | `holdings.quantity × price_cache.price ÷ silo_total_value` | API route, on demand |
| Drift amount % | `current_weight_pct − target_weights.weight_pct` | API route, on demand |
| Silo total value | `SUM(holdings.quantity × price_cache.price) + cash_balance` | API route, on demand |
| Cash target % | `100 − SUM(target_weights.weight_pct)` | API route, on demand |
| USD-converted silo value | `silo_total_value × fx_rates.rate_to_usd` | Frontend, using fetched fx_rates |
| Holdings staleness (days) | `NOW() − holdings.last_updated_at` | API route, included in holdings response |
| Schwab token expired | `NOW() > user_profiles.schwab_token_expires` | API route, included in profile response |
| Active silo count | `COUNT(*) WHERE user_id = $1 AND is_active = TRUE` | API route, before silo INSERT |
