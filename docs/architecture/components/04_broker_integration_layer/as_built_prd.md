# Component 4 — Broker Integration Layer: As-Built PRD

## 1. Concept & Vision

The Broker Integration Layer gives Rebalancify users a consolidated, live view of their investment portfolios across five platforms — Alpaca, BITKUB, InnovestX (Settrade equity + digital assets), Charles Schwab, and Webull — by fetching holdings automatically and surfacing them alongside manual silos. All broker API credentials are encrypted at rest using AES-256-GCM; plaintext keys never leave the server and are never exposed to the browser.

**In v1.0 (current):** Holdings are fetched and displayed. Order execution is deferred to v2.0 (EPIC-10).

---

## 2. What Was Built

### Encryption Layer

`lib/encryption.ts` provides `encrypt()` and `decrypt()` using AES-256-GCM with a 12-byte random IV per encryption operation. The output format is `iv_b64:authTag_b64:ciphertext_b64`. The `ENCRYPTION_KEY` environment variable (64-character hex, 32 bytes) is shared across all broker credentials. Every encryption is fresh — even identical plaintexts produce different ciphertexts.

`PATCH /api/profile` accepts broker credentials (`bitkub_key`/`bitkub_secret`, `innovestx_key`/`innovestx_secret`, `innovestx_digital_key`/`innovestx_digital_secret`, `webull_key`/`webull_secret`) and encrypts them before writing to `user_profiles` columns named `*_enc`. The Schwab OAuth tokens are encrypted via the callback route. **GET /api/profile never returns any `*_enc` column — only `*_connected: bool` booleans.**

### BITKUB Sync (STORY-013)

`POST /api/silos/:id/sync` routes to `syncBitkub()` when `silo.platform_type === 'bitkub'`.

Flow:
1. Decrypt `bitkub_key_enc` + `bitkub_secret_enc` from `user_profiles`
2. In parallel: fetch public ticker map (`GET /api/v2/market/ticker`) and authenticated wallet (`POST /api/v2/market/wallet` with HMAC-SHA256 signature)
3. Parse holdings (non-zero balances excluding THB) and THB cash balance
4. Upsert `holdings` rows (source: `bitkub_sync`), delete legacy non-`bitkub_sync` rows first
5. Upsert `price_cache` entries from the ticker map (THB prices, source: `bitkub`)
6. Update `silos.cash_balance` with THB balance
7. Update `silos.last_synced_at`

If BITKUB is unreachable, returns HTTP 503 `BROKER_UNAVAILABLE`.

### InnovestX Dual-Branch Sync (STORY-014, STORY-014b)

`POST /api/silos/:id/sync` routes to `syncInnovestx()` when `silo.platform_type === 'innovestx'`.

Two completely independent branches run in sequence. If one branch's credentials are absent, it is skipped with a warning in `sync_warnings[]` — the other branch still executes.

**Equity branch (Settrade OAuth):**
1. Decrypt `innovestx_key_enc` + `innovestx_secret_enc`
2. `POST /api/ords/SETTrade/oauth/token` with Basic Auth → access token
3. `GET /api/ords/SETTrade/Investor/Account` → account number
4. `GET /api/ords/SETTrade/Investor/Account/{accountNo}/Portfolio` → positions
5. Upsert holdings (source: `innovestx_sync`, price_source: `finnhub`), delete legacy rows first
6. Call `fetchPrice()` for each ticker (Finnhub)

**Digital Asset branch (HMAC-SHA256):**
1. Decrypt `innovestx_digital_key_enc` + `innovestx_digital_secret_enc`
2. Build `X-INVX-SIGNATURE` using the compound message: `apiKey + METHOD + host + path + query + contentType + requestUid + timestamp + body`
3. `GET /api/v1/digital-asset/account/balance/inquiry` with signature headers
4. Upsert holdings (source: `innovestx_sync`, price_source: `coingecko`), delete legacy rows first
5. Call `fetchPrice()` for each asset (CoinGecko)

### Charles Schwab OAuth + Sync (STORY-015, STORY-015b)

**OAuth initiation** (`GET /api/auth/schwab`):
- Generates a UUID v4 CSRF state token stored in an HTTP-only cookie (60-min TTL)
- Redirects to `https://api.schwabapi.com/v1/oauth/authorize` with client_id and redirect_uri

**OAuth callback** (`GET /api/auth/schwab/callback`):
- Validates CSRF state cookie matches `state` query param
- Exchanges authorization code for tokens via `POST https://api.schwabapi.com/v1/oauth/token` with Basic Auth (`clientId:clientSecret`)
- Encrypts both `access_token` and `refresh_token`, stores alongside `schwab_token_expires = now + 7 days`
- Clears the CSRF cookie, redirects to `/settings?schwab_connected=true`

**Schwab sync** (`POST /api/silos/:id/sync`, `syncSchwab()`):
- Checks `schwab_token_expires < NOW()` → returns HTTP 401 `SCHWAB_TOKEN_EXPIRED`
- Decrypts `schwab_access_enc`, fetches `GET /trader/v1/accounts?fields=positions` with Bearer token
- On HTTP 401 → returns `SCHWAB_TOKEN_EXPIRED` (user must re-authenticate)
- Upserts holdings (source: `schwab_sync`, price_source: `finnhub`), calls `fetchPrice()` for each

### Webull Sync (STORY-016)

`POST /api/silos/:id/sync` routes to `syncWebull()` when `silo.platform_type === 'webull'`.

Flow:
1. Decrypt `webull_key_enc` + `webull_secret_enc`
2. Build HMAC-SHA256 signature over `timestamp + METHOD + path` (timestamp from `Date.now().toString()`)
3. `GET /v1/account/positions` with headers `X-WBL-APIKEY`, `X-WBL-SIGNATURE`, `X-WBL-TIMESTAMP`
4. On network failure → HTTP 503 `BROKER_UNAVAILABLE`
5. Upserts holdings (source: `webull_sync`, price_source: `finnhub`), calls `fetchPrice()` for each

### Settings Page Broker Sections

`app/(dashboard)/settings/page.tsx` renders six credential sections (Alpaca is from Component 3):

| Section | Credential Fields | Connection Indicator |
|---|---|---|
| BITKUB | `bitkub_key`, `bitkub_secret` | Green/grey `ConnectionStatusDot` |
| InnovestX Settrade Equity | `innovestx_key`, `innovestx_secret` | Green/grey `ConnectionStatusDot` |
| InnovestX Digital Assets | `innovestx_digital_key`, `innovestx_digital_secret` | Green/grey `ConnectionStatusDot` |
| Charles Schwab | OAuth button ("Connect" / "Disconnect") | `TokenExpiryWarning` banner if expires < 2 days |
| Webull | `webull_key`, `webull_secret` | Green/grey `ConnectionStatusDot` |

All inputs use `type="password"` with a show/hide toggle. After save, the field displays `••••••••`.

### ExecutionModeNotice

In the Rebalancing Wizard Step 2 (`OrderReviewPanel.tsx`), a persistent non-dismissible banner reads:

> "These orders will not be submitted automatically. After reviewing, you will execute them manually on [Platform Name]."

This appears for all non-Alpaca silos. It cannot be dismissed.

### Schwab Token Expiry Cron

`GET /api/cron/drift-digest` (Vercel Cron, daily 08:00 UTC) runs as part of the drift digest job. For every user with a Schwab connection whose `schwab_token_expires < NOW() + 2 days`, it inserts a `schwab_token_expiring` notification (deduplicated — skips if an unread one already exists today). This surfaces in the `NotificationBell` badge.

---

## 3. Database Schema

### Encrypted Credential Columns (in `user_profiles`)

| Column | Type | Purpose |
|---|---|---|
| `bitkub_key_enc` | text | Encrypted BITKUB API key |
| `bitkub_secret_enc` | text | Encrypted BITKUB API secret |
| `innovestx_key_enc` | text | Encrypted Settrade App ID |
| `innovestx_secret_enc` | text | Encrypted Settrade App Secret |
| `innovestx_digital_key_enc` | text | Encrypted InnovestX Digital API key |
| `innovestx_digital_secret_enc` | text | Encrypted InnovestX Digital API secret |
| `schwab_access_enc` | text | Encrypted Schwab OAuth access token |
| `schwab_refresh_enc` | text | Encrypted Schwab OAuth refresh token |
| `schwab_token_expires` | timestamptz | Refresh token expiry (used for proactive warning) |
| `webull_key_enc` | text | Encrypted Webull API key |
| `webull_secret_enc` | text | Encrypted Webull API secret |

---

## 4. Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `BROKER_UNAVAILABLE` | 503 | Broker API unreachable or returned an error |
| `BITKUB_NOT_CONNECTED` | 403 | No encrypted BITKUB credentials stored |
| `INNOVESTX_NOT_CONNECTED` | 403 | No encrypted InnovestX credentials stored |
| `SCHWAB_NOT_CONNECTED` | 403 | No Schwab tokens stored |
| `SCHWAB_TOKEN_EXPIRED` | 401 | Schwab refresh token expired — must re-authenticate |
| `WEBULL_NOT_CONNECTED` | 403 | No encrypted Webull credentials stored |
| `MANUAL_SILO_NO_SYNC` | 422 | Manual silos cannot be synced |
| `ENCRYPTION_KEY_MISSING` | 500 | `ENCRYPTION_KEY` env var not set |
| `DECRYPTION_FAILED` | 500 | Ciphertext was tampered with |

---

## 5. Stories

| Story | Sub-components |
|---|---|
| STORY-013 | `02-bitkub_sync.md` |
| STORY-014 | `03-innovestx_sync.md` |
| STORY-014b | `03-innovestx_sync.md` |
| STORY-015 | `04-schwab_oauth.md` |
| STORY-015b | `05-schwab_sync.md` |
| STORY-016 | `06-webull_sync.md`, `07-settings_broker_sections.md`, `08-execution_mode_notice.md` |
| STORY-020 | `09-schwab_token_expiry_cron.md` |
