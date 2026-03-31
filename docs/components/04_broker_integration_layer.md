# Component 4 — Broker Integration Layer

## 1. The Goal

Provide automated holdings fetch and order execution for all non-Alpaca platforms: BITKUB (Thai crypto exchange), InnovestX (dual-sub-account: Settrade equity + digital assets), Charles Schwab (US equities via OAuth), and Webull (US/global stocks). In v1.0, holdings are fetched automatically and displayed in the Portfolio Data Layer; order execution is deferred to v2.0 (EPIC-10). This component reuses the AES-256-GCM encryption pattern established by Component 3 for all API key storage.

---

## 2. The Problem It Solves

Manual silos require investors to enter holdings by hand — error-prone and quickly stale. BITKUB, InnovestX, Schwab, and Webull each have proprietary APIs with different authentication schemes (API keys, OAuth 2.0, HMAC-SHA256 signatures). Without a unified integration layer that handles all four platforms, users with multi-exchange portfolios cannot see a consolidated view of their holdings, and the daily drift digest cannot evaluate their full portfolio.

---

## 3. The Proposed Solution / Underlying Concept

### Encryption Pattern (shared with Component 3)

All broker API keys and secrets are encrypted using the AES-256-GCM implementation from `lib/encryption.ts` (established in STORY-009). The `ENCRYPTION_KEY` environment variable is shared across all broker credentials. Each encrypted value stores its own unique 12-byte IV.

### Profile Storage

Each broker has its own pair of encrypted columns in `user_profiles`:

| Broker | Columns |
|---|---|
| Alpaca | `alpaca_key_enc`, `alpaca_secret_enc` (Component 3) |
| BITKUB | `bitkub_key_enc`, `bitkub_secret_enc` |
| InnovestX — Equity (Settrade) | `innovestx_key_enc`, `innovestx_secret_enc` |
| InnovestX — Digital Assets | `innovestx_digital_key_enc`, `innovestx_digital_secret_enc` |
| Charles Schwab | OAuth tokens stored separately (encrypted) |
| Webull | `webull_key_enc`, `webull_secret_enc` |

`PATCH /api/profile` accepts any combination of these credentials. `GET /api/profile` returns a `*_connected: bool` for each broker, indicating whether the encrypted columns are non-null.

### BITKUB Sync (STORY-013)

- Authenticated API call to BITKUB's wallet balance endpoint using decrypted `bitkub_key`/`bitkub_secret`
- BITKUB's `/api/market/ticker` response is used to update `price_cache` during sync — no separate price fetch needed
- `last_synced_at` updated after successful sync
- v1.0: `ExecutionModeTag: MANUAL` displayed on BITKUB silo card

### InnovestX — Dual-Sub-Account Sync (STORY-014, STORY-014b)

InnovestX exposes two completely separate APIs:

**Settrade Open API** (Thai equities — OAuth Bearer token):
- App ID + App Secret → OAuth token → `get_portfolio(account_no)`
- Equity prices fetched via Finnhub (Tier 2) and cached in `price_cache`

**InnovestX Digital Asset API** (HMAC-SHA256):
- `X-INVX-SIGNATURE`, `X-INVX-TIMESTAMP`, `X-INVX-REQUEST-UID` headers built from decrypted key + secret
- Digital asset prices fetched via CoinGecko (Tier 3) and cached in `price_cache`

The sync route runs both branches. Each branch handles its own auth failure independently — if only the digital key is missing, the equity sync still succeeds, and vice versa. A `sync_warnings` field describes any skipped sub-account.

### Charles Schwab OAuth (STORY-015, STORY-015b)

Schwab uses OAuth 2.0 — a different pattern from all other brokers:

1. User clicks "Connect Schwab" → redirect to Schwab authorization URL
2. Schwab redirects back to `/api/auth/schwab/callback` with an authorization code
3. Callback exchanges code for access token + refresh token (both encrypted and stored)
4. `schwab_token_expires` is stored from the token response

**Token refresh**: Tokens expire. The Vercel Cron Job from STORY-020 proactively checks `schwab_token_expires < NOW() + INTERVAL '2 days'` and inserts a `schwab_token_expiring` notification. When `schwab_token_expires < NOW()`, sync returns HTTP 401 `SCHWAB_TOKEN_EXPIRED`. The Settings page shows a `TokenExpiryWarning` banner prompting re-authentication.

### Webull Sync (STORY-016)

- API key + secret encrypted and stored
- Holdings fetched from Webull API
- Settings page shows Webull section with `$500 minimum account value` advisory notice (UI-only, not enforced backend-side — if the account is below $500, Webull's own API returns an error surfaced as `BROKER_UNAVAILABLE`)

### Settings Page Consolidation (STORY-016)

All five broker sections appear in one Settings page, each with:
- `ConnectionStatusDot` (green = connected, grey = not connected)
- `type="password"` inputs with show/hide toggle
- After save: masked display (`••••••••`)

The Settings page lives in `app/(dashboard)/settings/page.tsx` and uses sections established in Component 2.

### ExecutionModeNotice (STORY-016)

In the Rebalancing Wizard Step 2, for any non-Alpaca silo, a persistent non-dismissible banner reads:

> "These orders will not be submitted automatically. After reviewing, you will execute them manually on [Platform Name]."

This is rendered by `ExecutionModeNotice` and is the same notice referenced in Component 3 (STORY-011b AC-5).

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Key encryption round-trip | Unit test: encrypt → decrypt → original value for each broker pair |
| IV uniqueness per field | Unit test: same key encrypted twice → different ciphertexts |
| Key never in response | `grep` for broker key fields in any GET response → zero hits |
| Zero browser requests | DevTools Network: no requests to any broker API domain during sync |
| BITKUB partial price data | Unit/integration: verify `/api/market/ticker` updates price_cache during sync |
| InnovestX branch independence | Test: equity credentials only → digital sync skipped with `sync_warnings`; vice versa |
| HMAC-SHA256 signature | Test against InnovestX API docs test vectors |
| Schwab token expiry path | Manually set `schwab_token_expires` to past → sync returns 401 `SCHWAB_TOKEN_EXPIRED` |
| Schwab proactive notification | Vercel Cron Job inserts `schwab_token_expiring` notification 2 days before expiry |
| ExecutionModeNotice per platform | Manual: open wizard for BITKUB, InnovestX, Schwab, Webull silos → banner appears, non-dismissible |
| All keys masked after save | Manual: save credentials → inputs show `••••••••` |
| RLS isolation | Two-user test: user A's broker holdings not readable by user B |
| InnovestX equity prices | Verify Finnhub called for Thai equity tickers; CoinGecko for digital assets |

---

## 5. Integration

### API Routes

| Method + Path | What It Does |
|---|---|
| `PATCH /api/profile` | Encrypts and stores any combination of broker credentials |
| `GET /api/profile` | Returns `*_connected` booleans for all brokers |
| `POST /api/silos/:id/sync` | Dispatches to broker-specific branch (Alpaca / BITKUB / InnovestX equity + digital / Schwab / Webull) |
| `GET /api/silos/:id/holdings` | Returns holdings (synced data displayed here) |
| `app/api/auth/schwab/route.ts` | Initiates Schwab OAuth redirect |
| `app/api/auth/schwab/callback/route.ts` | OAuth callback, exchanges code for tokens |

### Feeds Into

| Component | How |
|---|---|
| **Component 2 — Portfolio Data Layer** | Sync endpoints upsert into `holdings` table; `last_synced_at` updated on `silos` |
| **Component 3 — Rebalancing Engine** | `ExecutionModeNotice` shown in wizard for non-Alpaca silos; execute endpoint extended for all platforms in EPIC-10 |
| **Component 1 — Auth & Foundation** | Settings page consolidated here |

### Consumed From

| Component | What It Provides |
|---|---|
| **Component 3 — Rebalancing Engine** | AES-256-GCM encryption pattern (`lib/encryption.ts`) reused here |
| **Component 5 — Market Data** | `priceService.ts` for price lookups during sync; Finnhub for equities, CoinGecko for crypto |

### External APIs Called

| Platform | Auth Method | API Called |
|---|---|---|
| BITKUB | API Key + Secret | Wallet balance, Market ticker (for price cache) |
| InnovestX — Equity | OAuth (Settrade) | `get_portfolio()` |
| InnovestX — Digital | HMAC-SHA256 | Balance endpoint |
| Charles Schwab | OAuth 2.0 | Account positions |
| Webull | API Key + Secret | Positions |
