# docs/architecture/03-api-contract.md — API Contract

## AGENT CONTEXT

**What this file is:** The complete specification of all Next.js API routes — request shapes, response shapes, error codes, and conventions.
**Derived from:** TECH_DOCS_v1.2.md (DOC-02 API Contract)
**Connected to:** docs/architecture/02-database-schema.md (field names must match), docs/architecture/04-component-tree.md (components use these endpoints)
**Critical rules for agents using this file:**
- All field names here must exactly match column names in docs/architecture/02-database-schema.md. This file does not win naming conflicts — the schema file does.
- All monetary values in responses are strings with 8 decimal places: `"30.00000000"`.
- All percentage values in responses are numeric with 3 decimal places: `30.000`.
- IDs are UUID v4 strings.
- All API keys received by endpoints are encrypted server-side immediately. They are never returned in any response.

---

## Conventions

| Convention | Value |
|---|---|
| Base path | `/api` (Next.js App Router routes under `app/api/`) |
| Auth header | `Authorization: Bearer <supabase_jwt>` |
| Content-Type | `application/json` |
| Date format | ISO 8601 |
| Monetary values | Strings, 8 decimal places — `"30.00000000"` |
| Percentages | Numeric, 3 decimal places — `30.000` |
| IDs | UUID v4 strings |
| Pagination | `?page=1&limit=20` |

---

## Standard Error Response

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "detail": "Optional additional detail for the user"
  }
}
```

**Error codes:**

| Code | HTTP Status | Meaning |
|---|---|---|
| `SILO_LIMIT_REACHED` | 422 | User already has 5 active silos |
| `MANUAL_SILO_NO_SYNC` | 422 | Sync called on a manual silo |
| `BALANCE_INSUFFICIENT` | 422 | Pre-flight validation failed |
| `BROKER_UNAVAILABLE` | 503 | External brokerage API unreachable |
| `SCHWAB_TOKEN_EXPIRED` | 401 | Schwab OAuth token needs refresh |
| `RATE_LIMIT_EXCEEDED` | 429 | Upstream API rate limit hit |
| `ASSET_MAPPING_EXISTS` | 409 | Asset already mapped to this silo |
| `SESSION_NOT_FOUND` | 404 | Rebalance session ID invalid |
| `LLM_KEY_MISSING` | 403 | Research Hub called with no LLM key configured |
| `LLM_API_ERROR` | 502 | LLM provider returned an error |
| `LLM_ALLOCATION_OUTPUT` | 422 | LLM output contained a specific allocation percentage recommendation despite system prompt restriction |

---

## Auth (Supabase Client SDK — not API routes)

```typescript
supabase.auth.signUp({ email, password })
supabase.auth.signInWithPassword({ email, password })
supabase.auth.resetPasswordForEmail(email)
supabase.auth.signOut()
```

---

## Profile Endpoints

### GET /api/profile

**Response 200:**
```json
{
  "id": "uuid",
  "display_name": "string | null",
  "global_currency": "USD",
  "show_usd_toggle": false,
  "drift_notif_channel": "both",
  "alpaca_mode": "paper",
  "alpaca_connected": true,
  "bitkub_connected": false,
  "innovestx_equity_connected": false,
  "innovestx_digital_connected": false,
  "schwab_connected": false,
  "schwab_token_expired": false,
  "webull_connected": false,
  "llm_connected": false,
  "llm_provider": null,
  "llm_model": null,
  "active_silo_count": 3,
  "silo_limit": 5,
  "onboarded": false,
  "progress_banner_dismissed": false,
  "notification_count": 0,
  "created_at": "2026-03-01T00:00:00Z"
}
```

**Note:** `*_connected` booleans are derived from whether the corresponding `*_key_enc` column is non-null. Raw encrypted keys are never returned. `notification_count` is derived as `COUNT(*) FROM notifications WHERE user_id = auth.uid() AND is_read = FALSE`. `onboarded` is `TRUE` after the onboarding modal has been shown and acknowledged.

### PATCH /api/profile

All fields optional. API keys received in plain text, encrypted server-side immediately, never returned.

```json
{
  "display_name": "string",
  "show_usd_toggle": false,
  "drift_notif_channel": "app | email | both",
  "alpaca_key": "plain text — encrypted before storage",
  "alpaca_secret": "plain text — encrypted before storage",
  "alpaca_mode": "paper | live",
  "bitkub_key": "plain text",
  "bitkub_secret": "plain text",
  "innovestx_key": "plain text — Settrade App ID (equity sub-account)",
  "innovestx_secret": "plain text — Settrade App Secret (equity sub-account)",
  "innovestx_digital_key": "plain text — Digital Asset API Key (digital asset sub-account)",
  "innovestx_digital_secret": "plain text — Digital Asset API Secret (digital asset sub-account)",
  "schwab_auth_code": "OAuth code — exchanged server-side for tokens",
  "webull_key": "plain text",
  "webull_secret": "plain text",
  "llm_provider": "openrouter | google | groq | openai | anthropic | deepseek",
  "llm_key": "plain text",
  "llm_model": "string",
  "onboarded": true,
  "progress_banner_dismissed": true
}
```

**Response 200:** Same shape as GET /api/profile.

---

## Silo Endpoints

### GET /api/silos

**Response 200:**
```json
[
  {
    "id": "uuid",
    "name": "My Alpaca Portfolio",
    "platform_type": "alpaca",
    "base_currency": "USD",
    "drift_threshold": 5.0,
    "is_active": true,
    "last_synced_at": "2026-03-19T10:00:00Z | null",
    "total_value": "10000.00000000",
    "weights_sum_pct": 95.000,
    "cash_target_pct": 5.000,
    "active_silo_count": 3,
    "silo_limit": 5
  }
]
```

### POST /api/silos

**Request:**
```json
{
  "name": "string",
  "platform_type": "alpaca | bitkub | innovestx | schwab | webull | manual",
  "base_currency": "USD",
  "drift_threshold": 5.0
}
```

**Response 201:** Silo object (same shape as one item in GET /api/silos array).
**Error 422:** `SILO_LIMIT_REACHED` if user already has 5 active silos.

### PATCH /api/silos/:silo_id

**Request (all fields optional):**
```json
{ "name": "string", "base_currency": "THB", "drift_threshold": 3.0 }
```

**Response 200:** Updated silo object.

### DELETE /api/silos/:silo_id

Sets `is_active = FALSE` (soft delete). Data preserved.
**Response 200:** `{ "deleted": true, "silo_id": "uuid" }`

### POST /api/silos/:silo_id/sync

Triggers holdings fetch for the silo's platform type.

**Response 200:**
```json
{
  "synced_at": "2026-03-19T10:00:00Z",
  "holdings_updated": 5,
  "cash_balance": "500.00000000",
  "platform": "alpaca | bitkub | innovestx | schwab | webull"
}
```

**Error 422:** `MANUAL_SILO_NO_SYNC` — platform_type is 'manual'
**Error 401:** `SCHWAB_TOKEN_EXPIRED` — Schwab token needs re-auth
**Error 503:** `BROKER_UNAVAILABLE` — brokerage API unreachable

---

## Holdings Endpoints

### GET /api/silos/:silo_id/holdings

**Response 200:**
```json
{
  "cash_balance": "500.00000000",
  "total_value": "10000.00000000",
  "holdings": [
    {
      "id": "uuid",
      "asset_id": "uuid",
      "ticker": "AAPL",
      "name": "Apple Inc.",
      "asset_type": "stock",
      "quantity": "10.00000000",
      "cost_basis": "1500.00000000",
      "current_price": "185.20000000",
      "current_value": "1852.00000000",
      "current_weight_pct": 18.520,
      "target_weight_pct": 20.000,
      "drift_pct": -1.480,
      "drift_breached": false,
      "source": "manual",
      "stale_days": 0,
      "last_updated_at": "2026-03-19T10:00:00Z"
    }
  ]
}
```

### POST /api/silos/:silo_id/holdings

Manual silos only.

**Request:**
```json
{
  "asset_id": "uuid",
  "quantity": "10.00000000",
  "cost_basis": "1500.00000000",
  "cash_balance": "500.00000000"
}
```

**Response 201:** Holding object.

### PATCH /api/silos/:silo_id/holdings/:holding_id

Manual silos only. Updates quantity, cost_basis, or cash_balance.

---

## Asset Search & Mapping

### GET /api/assets/search?q=:query&type=stock|crypto

Queries Finnhub (stock) or CoinGecko (crypto). Returns ranked candidates.

**Response 200:**
```json
[
  {
    "ticker": "AAPL",
    "name": "Apple Inc.",
    "asset_type": "stock",
    "price_source": "finnhub",
    "exchange": "NASDAQ",
    "current_price": "185.20000000"
  }
]
```

### POST /api/silos/:silo_id/asset-mappings

**Request:**
```json
{
  "ticker": "AAPL",
  "name": "Apple Inc.",
  "asset_type": "stock",
  "price_source": "finnhub",
  "local_label": "apple"
}
```

**Response 201:** `{ "asset_id": "uuid", "mapping_id": "uuid", "ticker": "AAPL" }`
**Error 409:** `ASSET_MAPPING_EXISTS` — mapping already exists for this silo + asset combination.

---

## Target Weights

### GET /api/silos/:silo_id/target-weights

**Response 200:**
```json
{
  "weights_sum_pct": 95.000,
  "cash_target_pct": 5.000,
  "sum_warning": true,
  "weights": [
    { "asset_id": "uuid", "ticker": "AAPL", "weight_pct": 50.000 },
    { "asset_id": "uuid", "ticker": "BTC", "weight_pct": 45.000 }
  ]
}
```

### PUT /api/silos/:silo_id/target-weights

Atomic replacement — replaces all weights for the silo.

**Request:**
```json
{
  "weights": [
    { "asset_id": "uuid", "weight_pct": 50.000 },
    { "asset_id": "uuid", "weight_pct": 45.000 }
  ]
}
```

**Validation:** Each `weight_pct` must be 0 ≤ n ≤ 100. Sum ≠ 100 is allowed (warning only — `sum_warning: true` in response).
**Response 200:** Same shape as GET /api/silos/:silo_id/target-weights.

---

## Rebalancing Endpoints

### POST /api/silos/:silo_id/rebalance/calculate

**Request:**
```json
{
  "mode": "partial | full",
  "include_cash": false,
  "cash_amount": "500.00000000"
}
```

**Response 200:**
```json
{
  "session_id": "uuid",
  "mode": "partial",
  "balance_valid": true,
  "balance_errors": [],
  "weights_sum_pct": 95.000,
  "cash_target_pct": 5.000,
  "snapshot_before": { "holdings": [], "prices": {}, "weights": {}, "total_value": "10000.00000000" },
  "orders": [
    {
      "id": "uuid",
      "asset_id": "uuid",
      "ticker": "AAPL",
      "order_type": "buy",
      "quantity": "2.00000000",
      "estimated_value": "370.40000000",
      "price_at_calc": "185.20000000",
      "weight_before_pct": 18.520,
      "weight_after_pct": 20.000
    }
  ]
}
```

**Error 422:** `balance_valid: false` with `balance_errors` array describing constraint failures.

### POST /api/silos/:silo_id/rebalance/execute

**Request:**
```json
{
  "session_id": "uuid",
  "approved_order_ids": ["uuid", "uuid"],
  "skipped_order_ids": ["uuid"]
}
```

- For Alpaca silos: submits approved orders to Alpaca API. Sets `alpaca_order_id` on each executed order.
- For all other API silos in v1.0: marks approved orders as `execution_status = 'manual'`.
- For manual silos: marks approved orders as `execution_status = 'manual'`.

**Response 200:**
```json
{
  "session_id": "uuid",
  "executed_count": 3,
  "skipped_count": 1,
  "failed_count": 0,
  "orders": [{ "id": "uuid", "execution_status": "executed | manual | skipped | failed | pending" }]
}
```

### GET /api/silos/:silo_id/rebalance/history

Paginated session list for one silo.
**Response 200:** Array of session summaries with pagination metadata.

### GET /api/rebalance/history

Aggregate history across all user's silos. Each session includes `silo_name` and `silo_id`.

---

## News Endpoints

### GET /api/news/portfolio

Portfolio news filtered to user's holdings tickers. Applies two-tier matching.

### GET /api/news/macro

General macro news. `is_macro = TRUE` filter.

### POST /api/news/refresh

Force re-fetch, bypassing TTL.

**Request (optional):** `{ "tickers": ["AAPL", "BTC"] }` — if omitted, refreshes all portfolio tickers.

### PATCH /api/news/articles/:article_id/state

**Request:** `{ "is_read": true }` or `{ "is_dismissed": true }`

---

## Discovery Endpoints

### GET /api/assets/:asset_id/peers

Returns 5–8 peer assets via Finnhub `/stock/peers`. Falls back to static `sector_taxonomy.json`.

### GET /api/market/top-movers?type=stocks|crypto

Returns top 5 gainers and top 5 losers.

### GET /api/silos/:silo_id/drift

Returns current drift snapshot for all holdings in the silo.

**Response 200:**
```json
{
  "silo_id": "uuid",
  "drift_threshold": 5.0,
  "computed_at": "2026-03-19T10:00:00Z",
  "assets": [
    {
      "asset_id": "uuid",
      "ticker": "AAPL",
      "current_weight_pct": 22.000,
      "target_weight_pct": 20.000,
      "drift_pct": 2.000,
      "drift_state": "green | yellow | red",
      "drift_breached": false
    }
  ]
}
```

---

## FX Rates

### GET /api/fx-rates

Returns all cached FX rates (60-min TTL). Re-fetches from ExchangeRate-API if stale.

**Response 200:** `{ "THB": { "rate_to_usd": 0.02778, "fetched_at": "..." }, ... }`

---

## Research Endpoints (v2.0)

### POST /api/research/:ticker

Triggers or retrieves cached research session.

**Response 200:**
```json
{
  "session_id": "uuid",
  "ticker": "AAPL",
  "llm_provider": "google",
  "llm_model": "gemini-2.0-flash",
  "cached": true,
  "output": {
    "sentiment": "bullish",
    "confidence": 0.82,
    "risk_factors": ["Concentration risk in iPhone revenue", "Regulatory pressure in EU"],
    "summary": "string (150-300 words)",
    "sources": ["string"]
  },
  "created_at": "2026-03-19T10:00:00Z"
}
```

**Error 403:** `LLM_KEY_MISSING` — no LLM key configured.
**Error 502:** `LLM_API_ERROR` — provider returned an error.

---

## Knowledge Base Endpoints

### POST /api/knowledge/upload
Uploads a document (PDF or Markdown) to the user's custom knowledge base. The document is parsed, chunked, embedded, and stored in `knowledge_chunks`.

**Request:** `multipart/form-data`
- `file`: The document file (PDF or MD)

**Response (201):**
```json
{
  "success": true,
  "document_id": "uuid",
  "file_name": "filename.pdf",
  "chunks_inserted": 12
}
```

**Error 400:** `UNSUPPORTED_FILE_TYPE` — only PDF and MD files are supported.
**Error 422:** `PDF_PARSE_ERROR` — failed to extract text from PDF.
**Error 422:** `EMPTY_DOCUMENT` — no usable text found in document.

### GET /api/knowledge/corpus-size
Returns the total storage size of the `knowledge_chunks` table in bytes. Used for monitoring the 500MB free tier limit.

**Response (200):**
```json
{
  "size_bytes": 1048576
}
```

### POST /api/knowledge/ingest
Reads all default research files from the `/knowledge/` directory, chunks them, generates embeddings, and upserts them into `knowledge_chunks`.

**Request:** `POST /api/knowledge/ingest` (no body)

**Response (200):**
```json
{
  "files_processed": 10,
  "chunks_inserted": 145,
  "skipped_files": []
}
```
