# docs/prd/06-platform-support.md — Platform Support Matrix

## AGENT CONTEXT

**What this file is:** The complete specification of every supported investment platform — authentication method, API endpoints, v1.0/v2.0 capability split, and known constraints.
**Derived from:** PRD_v1.3.md Section 4 (all subsections)
**Connected to:** docs/architecture/02-database-schema.md (silos.platform_type), docs/architecture/03-api-contract.md (sync endpoints), stories/EPIC-03, stories/EPIC-04
**Critical rules for agents using this file:**
- `platform_type` values in the database must exactly match the identifiers in the table below: `'alpaca' | 'bitkub' | 'innovestx' | 'schwab' | 'webull' | 'manual'`
- v1.0 execution is Alpaca only. For all other platforms, orders are displayed as manual instructions. This must be enforced in the rebalancing wizard `ExecutionModeNotice`.

---

## Platform Support Matrix

| Platform | DB `platform_type` | Type | Region | Holdings Fetch | Order Execution | Exec Version |
|---|---|---|---|---|---|---|
| **Alpaca** | `alpaca` | US Stocks / ETFs | US (Global) | v1.0 automated | v1.0 automated (user-approved) | **v1.0** |
| **BITKUB** | `bitkub` | Crypto Exchange | Thailand | v1.0 automated | v2.0 | v2.0 |
| **InnovestX** | `innovestx` | Thai Equities + Digital Assets | Thailand | v1.0 automated | v2.0 | v2.0 |
| **Charles Schwab** | `schwab` | US Stocks / ETFs | US | v1.0 automated | v2.0 | v2.0 |
| **Webull** | `webull` | US/Global Stocks | US / Thailand | v1.0 automated | v2.0 | v2.0 |
| **DIME** | `manual` | Thai + US Stocks, Mutual Funds | Thailand | Manual entry (permanent) | Never | — |
| **All other platforms** | `manual` | Any | Any | Manual entry | Never | — |

**v1.0 execution note:** Only Alpaca supports automated order execution in v1.0. All other API-connected platforms fetch holdings automatically but display a rebalancing plan that the user then executes manually on their platform. The `ExecutionModeTag` component and `ExecutionModeNotice` banner communicate this clearly.

---

## Alpaca

- **Docs:** https://alpaca.markets/docs/api-references/broker-api/
- **Auth:** OAuth 2.0 — API Key + Secret stored encrypted in `user_profiles.alpaca_key_enc` / `alpaca_secret_enc`
- **Holdings fetch:** `GET /v2/positions` — returns quantity per symbol
- **Cash balance:** `GET /v2/account` — `cash` field
- **Order execution (v1.0):** `POST /v2/orders` — market or limit orders. Submitted only after user confirms in `ConfirmDialog`.
- **Modes:** Paper (`paper-api.alpaca.markets`) and live (`api.alpaca.markets`) — user selects in Settings. When live mode is active, persistent amber `LIVE` badge appears on silo card and rebalancing wizard.
- **base_currency for silos:** `USD`

---

## BITKUB

- **Docs:** https://github.com/bitkub/bitkub-official-api-docs
- **Auth:** `X-BTK-APIKEY` header + HMAC-SHA256 signature (`X-BTK-SIGN`) + `X-BTK-TIMESTAMP`
- **Holdings fetch:** `POST /api/market/wallet` — returns crypto balances
- **Prices:** `GET /api/market/ticker` — returns current prices for all pairs
- **API version:** v3 for market/order endpoints (used in v2.0)
- **v1.0 scope:** Holdings fetch only. Prices cached to `price_cache` from ticker endpoint.
- **base_currency for silos:** `THB`

---

## InnovestX

- **Docs (Equities):** https://developer.settrade.com/
- **Docs (Digital Assets):** https://api-docs.innovestxonline.com/
- **Auth (Equities):** Settrade Open API — OAuth Bearer token via App ID + App Secret → stored in `user_profiles.innovestx_key_enc` / `innovestx_secret_enc`
- **Auth (Digital Assets):** HMAC-SHA256 with `X-INVX-SIGNATURE`, `X-INVX-TIMESTAMP`, `X-INVX-REQUEST-UID`
- **Holdings fetch:** `get_portfolio(account_no)` via Settrade SDK; proprietary endpoint for digital assets
- **⚠️ Digital Asset credential acquisition:** The Digital Asset API Key and Secret are NOT available through a self-service developer portal. Contact InnovestX support directly to request API access for the digital asset sub-account. There may be KYC tier requirements or a waiting list. Investigate and document the acquisition path before STORY-014b begins — do not assume the credentials can be obtained on demand.
- **v1.0 scope:** Holdings fetch automated for both equity and digital asset sub-accounts.
- **base_currency for silos:** `THB`

---

## Charles Schwab

- **Docs:** https://developer.schwab.com/
- **Auth:** OAuth 2.0 Authorization Code Grant. Access token valid 30 min; refresh token valid 7 days. Stored in `user_profiles.schwab_access_enc` / `schwab_refresh_enc` / `schwab_token_expires`.
- **Holdings fetch:** `GET /accounts/{accountHash}?fields=positions`
- **Cash balance:** `GET /accounts/{accountHash}`
- **Token constraint:** 7-day refresh token expiry requires periodic re-auth. Rebalancify prompts reconnect when `NOW() > schwab_token_expires`. Sync endpoint returns HTTP 401 when token is expired.
- **v1.0 scope:** Holdings fetch automated.
- **base_currency for silos:** `USD`

---

## Webull

- **Docs:** https://developer.webull.com/api-doc/
- **Auth:** OAuth 2.0 via App Key + App Secret. Requires minimum $500 account value for API provisioning (warn user in Settings).
- **Holdings fetch:** `GET /account/positions`
- **Cash balance:** `GET /account/balance`
- **v1.0 scope:** Holdings fetch automated.
- **base_currency for silos:** `USD`

---

## DIME (Manual — Permanent)

DIME uses Alpaca's Broker API on its backend but exposes no public developer API and no browser extension surface. It is and will always remain a manual silo.

- **Holdings:** User enters quantities manually in the app.
- **Prices:** Fetched automatically via Finnhub using the confirmed ticker mapping (DIME holds US stocks that trade on US exchanges).
- **base_currency for silos:** `THB` (DIME is a Thai platform; base currency is THB even though some underlying assets price in USD)
- **Conflict note (resolved):** DIME's base currency is `THB` by default — overriding the schema default of `USD`. This is the correct behaviour per PRD Section 4.7.

---

## All Other Platforms

Any platform not listed above uses `platform_type = 'manual'`. Users enter quantities. Prices are fetched via Finnhub (stocks/ETFs) or CoinGecko (crypto) using the confirmed ticker mapping.

---

## Plugin Architecture (Future — Not Shipped)

For platforms without a public API but with a web application (K-Cyber Trade, Bualuang), a browser extension plugin architecture is defined for future contributors. Scope: read-only holdings import only. Out of scope for v1.0 and v2.0.
