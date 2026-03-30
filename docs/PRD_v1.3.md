# Rebalancify — Product Requirements Document

**Version:** 1.3
**Date:** March 2026
**Status:** Draft
**Classification:** Open Source / Academic

> An open-source portfolio management tool for retail investors holding assets across multiple platforms. It centralises holdings, calculates precise rebalancing orders based on user-defined target weights, and surfaces market news and asset insights — leaving every allocation decision and trade execution strictly in the user's hands.

---

## AGENT CONTEXT

This document is the original product specification for Rebalancify and serves as read-only historical context. The current working specification for each feature lives in `docs/prd/features/F[N]-*.md`. Those files were updated after this document was frozen and take precedence for implementation. When `docs/prd/features/` files conflict with this document, follow `docs/prd/features/`. See `CONFLICT_RESOLVER.md` Section 2.5 for the resolution procedure.

**Connected documents:**
- `TECH_DOCS.md` — Data model, API contract, component tree, ADR, build order
- `FEATURES.md` — Professor-facing features and requirements document
- `PROGRESS.md` — Living build phase tracker

**Changes from v1.2:**
- Section 2.3: Silo limit (5 per user) added to technical comfort matrix
- Section 4.1: Platform support table updated — execution version column clarified for all platforms
- Section 4.2: Alpaca execution confirmed in v1.0
- Section 4.3–4.5: BITKUB, InnovestX, Schwab, Webull execution explicitly deferred to v2.0
- Section 5.5: LLM provider architecture rewritten — 5 direct providers specified with free-tier status; OpenRouter as optional convenience gateway, never required
- Section 9: PDPA compliance requirement formalised
- Section 9: Resend (free tier) locked as transactional email provider for drift digest
- Section 10: Decision log updated — entries 22–27 added
- Section 11: All open questions closed

---

## 1. Executive Summary

### 1.1 Problem Statement

Retail investors holding assets across multiple disconnected platforms face a persistent operational challenge: maintaining their desired asset allocation requires tedious manual calculation across accounts that cannot communicate with each other. Professional robo-advisors partially solve this problem but charge ongoing fees, enforce rigid allocation models, and rarely support non-US or crypto platforms.

### 1.2 Product Vision

Rebalancify is a free, open-source, production-grade web application that gives retail investors a single decision-support hub for managing, analysing, and rebalancing multi-platform portfolios. It is platform-agnostic, respects user autonomy by never making allocation decisions on behalf of the user, and exposes its full source code on GitHub while remaining accessible through a hosted production URL.

### 1.3 Core Values

- **User Autonomy** — the user always makes the final investment decision.
- **Transparency** — all calculations are deterministic and auditable; all AI outputs carry explicit disclaimers.
- **Data-Driven Insights** — aggregated news, sentiment, and peer data surface information users would otherwise spend hours gathering.
- **Platform Agnosticism** — the app works with any brokerage, whether or not an API integration exists.

### 1.4 Release Roadmap

| Release | Scope | Status |
|---|---|---|
| v1.0 (MVP) | Portfolio Tracking, Rebalancing Engine, Platform Silos, Alpaca Execution, Drift Monitoring, News Feed, Asset Discovery | This PRD |
| v2.0 | Automated execution for BITKUB, InnovestX, Schwab, Webull; AI Research Hub (Trust Engine); RAG pipeline; LLM Insight layer | Post-MVP |
| v3.0+ | Tax-lot tracking, additional exchange integrations, native mobile app, GraphRAG upgrade | Future |

---

## 2. Target Users

### 2.1 Primary Persona — The Long-Term Self-Directed Investor

Holds a diversified portfolio across two or more platforms simultaneously. Follows a passive or semi-passive strategy with infrequent rebalancing (quarterly or annually). Understands investment concepts (asset allocation, target weights, market sectors) but is not a software developer and should not need to interact with API keys unless they choose to enable advanced integrations.

### 2.2 Geographic Scope

Global audience, English interface. Initial platform integrations reflect the developer's context (Thailand + US) but the architecture accommodates any platform that exposes a REST API or accepts manual data entry.

### 2.3 Technical Comfort Matrix

| Capability | Required? | Notes |
|---|---|---|
| Create account / log in | Yes — all users | Email + password via Supabase Auth |
| Manual data entry (holdings, quantities, weights) | Yes — all users | Core workflow. Users never enter prices. |
| Confirm asset ticker mapping (one-time per asset) | Yes — manual silo users | Simple search-and-confirm. Done once per asset per silo. |
| Configure platform API key (Alpaca, BITKUB, etc.) | Optional | Step-by-step instructions provided in-app |
| Supply LLM API key (v2.0) | Optional | Required for AI Research Hub only. Multiple free options available. |
| Clone the GitHub repository | Optional | For developers who prefer self-hosting |

**Silo limit:** Each user account is limited to a maximum of **5 active platform silos**. This protects database storage on the free Supabase tier and is sufficient for the target persona who typically uses 2–4 platforms.

---

## 3. Non-Goals (Explicit Out of Scope for v1.0)

| Out of Scope | Rationale |
|---|---|
| App holds or custodies user funds | Calculation and display tool only. Money stays on the user's brokerage. |
| Tax-lot tracking or tax optimisation | Regulatory complexity. Deferred. |
| Options, futures, derivatives | Equity and crypto only in v1.0. |
| Non-US, non-crypto stock exchanges (SET, LSE, etc.) | Deferred to v2.0+ |
| Specific percentage allocation advice from AI | Regulatory risk. AI outputs sentiment and risk factors only — never target weights. |
| Executing trades without explicit user approval | All execution requires a manual confirmation step. |
| Native iOS or Android app | PWA covers mobile in v1.0. |
| Multi-user / shared account management | Single-user model only. |
| Live price alert push notifications | Daily digest only. Real-time alerting deferred. |
| Manual entry of asset prices by the user | Prices always fetched automatically. Users enter quantities only. |
| Historical price storage | Current prices cached with TTL. No time-series price history stored. |
| Automated execution for BITKUB, InnovestX, Schwab, Webull | Deferred to v2.0. All four platforms support holdings fetch in v1.0; execution deferred. |

---

## 4. Supported Platforms

### 4.1 Platform Support Matrix

| Platform | Type | Region | Integration | Holdings Fetch | Order Execution | Exec Version |
|---|---|---|---|---|---|---|
| **Alpaca** | US Stocks / ETFs | US (Global) | Official REST API (OAuth) | v1.0 automated | v1.0 automated (user-approved) | **v1.0** |
| **BITKUB** | Crypto Exchange | Thailand | Official REST API (HMAC-SHA256) | v1.0 automated | v2.0 | v2.0 |
| **InnovestX** | Thai Equities + Digital Assets | Thailand | Settrade Open API (OAuth) + Proprietary Digital Asset API | v1.0 automated | v2.0 | v2.0 |
| **Charles Schwab** | US Stocks / ETFs | US | Official REST API (OAuth 2.0) | v1.0 automated | v2.0 | v2.0 |
| **Webull** | US/Global Stocks | US / Thailand | Official REST API (OAuth 2.0) | v1.0 automated | v2.0 | v2.0 |
| **DIME** | Thai + US Stocks, Mutual Funds | Thailand | None — Manual silo only | Manual entry | Never (no API) | — |
| **All other platforms** | Any | Any | Manual silo | Manual entry | Never | — |

**v1.0 execution story:** In v1.0, only Alpaca supports automated order execution. All other API-connected platforms (BITKUB, InnovestX, Schwab, Webull) fetch holdings automatically but display a rebalancing plan that the user then executes manually on their platform. This is explicitly communicated in the UI per platform.

**v2.0 execution story:** v2.0 adds automated order execution for BITKUB, InnovestX, Schwab, and Webull — making it the "multi-platform execution release."

### 4.2 Alpaca Integration Detail

- **Docs:** https://alpaca.markets/docs/api-references/broker-api/
- **Auth:** OAuth 2.0 with API Key + Secret stored encrypted in Supabase
- **Holdings:** `GET /v2/positions`
- **Cash balance:** `GET /v2/account`
- **Order execution (v1.0):** `POST /v2/orders` — market or limit orders, submitted only after user confirms in non-dismissible dialog
- **Modes:** Paper trading (`paper-api.alpaca.markets`) and live trading (`api.alpaca.markets`) — user selects in Settings
- **Scope:** Rebalancify fetches holdings and executes approved orders. Does not modify account settings.

### 4.3 BITKUB Integration Detail

- **Docs:** https://github.com/bitkub/bitkub-official-api-docs
- **Auth:** `X-BTK-APIKEY` + HMAC-SHA256 signature (`X-BTK-SIGN`) + `X-BTK-TIMESTAMP`
- **Holdings:** `POST /api/market/wallet`
- **Prices:** `GET /api/market/ticker`
- **Order endpoints (v2.0):** `POST /api/v3/market/place-bid` / `POST /api/v3/market/place-ask`
- **API version:** v3 for market/order endpoints; v4 for crypto deposit/withdrawal (migrated Feb 2025)
- **v1.0 scope:** Holdings fetch automated. Order execution is manual — user executes on BITKUB after reviewing the rebalancing plan in Rebalancify.
- **v2.0 scope:** Automated order execution added with explicit user approval dialog.

### 4.4 InnovestX Integration Detail

- **Docs (Equities):** https://developer.settrade.com/
- **Docs (Digital Assets):** https://api-docs.innovestxonline.com/
- **Auth (Equities):** Settrade Open API — OAuth Bearer token via App ID + App Secret
- **Auth (Digital Assets):** HMAC-SHA256 with `X-INVX-SIGNATURE`, `X-INVX-TIMESTAMP`, `X-INVX-REQUEST-UID`
- **Holdings:** `get_portfolio(account_no)` via Settrade SDK; proprietary endpoint for digital assets
- **v1.0 scope:** Holdings fetch automated for both equity and digital asset sub-accounts. Order execution is manual.
- **v2.0 scope:** Automated order execution via both Settrade and InnovestX APIs with user approval.

### 4.5 Charles Schwab Integration Detail

- **Docs:** https://developer.schwab.com/
- **Auth:** OAuth 2.0 Authorization Code Grant — access token valid 30 min; refresh token valid 7 days
- **Holdings:** `GET /accounts/{accountHash}?fields=positions`
- **Cash balance:** `GET /accounts/{accountHash}`
- **Token constraint:** The 7-day refresh token expiry requires periodic re-authentication. Rebalancify must prompt the user to reconnect when the token expires.
- **v1.0 scope:** Holdings fetch automated. Order execution is manual.
- **v2.0 scope:** Automated order execution via Schwab API with user approval. Token refresh handling must be robust before execution is enabled.

### 4.6 Webull Integration Detail

- **Docs:** https://developer.webull.com/api-doc/
- **Auth:** OAuth 2.0 via App Key + App Secret. Requires minimum $500 account value for API provisioning.
- **Holdings:** `GET /account/positions`
- **Cash balance:** `GET /account/balance`
- **v1.0 scope:** Holdings fetch automated. Order execution is manual.
- **v2.0 scope:** Automated order execution with user approval. Account minimum constraint documented to users.

### 4.7 DIME — Manual Only (Permanent)

DIME uses Alpaca's Broker API on its backend. It is a consumer-facing mobile app (iOS and Android) with no public developer API and no browser extension surface. It is not possible to programmatically read holdings or execute orders from an external application.

DIME is supported as a manual silo permanently. Users enter DIME holdings quantities manually. Prices for US stocks held on DIME are fetched automatically via Finnhub using the confirmed ticker mapping.

### 4.8 Plugin Architecture (Future Platforms)

For platforms without a public API but with a web application (e.g., K-Cyber Trade, Bualuang), a browser extension plugin architecture is defined for future contributors:

- **Mechanism:** Chrome/Edge extension injects a content script that intercepts XHR responses containing portfolio JSON payloads.
- **Data flow:** Extension captures holdings JSON → sends to Rebalancify backend via secure local message → stored in holdings table.
- **Scope:** Read-only holdings import only. No order execution via plugin.
- **Status:** Out of scope for v1.0 and v2.0. Architecture defined as a contribution path.
- **ToS note:** Users are warned that browser extensions may violate the platform's Terms of Service.

---

## 5. System Architecture

### 5.1 Deployment Model

Production hosted web application. Full source code on GitHub. Users may access the live hosted instance or clone to self-host — both modes work without code modification.

### 5.2 Technology Stack (Free Tier Constrained)

| Layer | Technology | Justification |
|---|---|---|
| Frontend | Next.js 14 / React (PWA) | SSR + PWA; Vercel-native deployment |
| Hosting | Vercel (free tier) | Zero-cost static + serverless hosting |
| Backend API | Next.js API Routes (Vercel serverless) | API keys held server-side only; no separate deployment |
| Database | Supabase PostgreSQL (free tier) | 500 MB free; RLS for data isolation |
| Authentication | Supabase Auth | Email + password; built-in password reset |
| Vector Store (v2.0) | Supabase pgvector extension | RAG similarity search; already in stack; no extra cost |
| FX Conversion | ExchangeRate-API (free tier) | Live FX rates; 60-min TTL cache |
| Stock News + Prices | Finnhub + FMP (free tier) | Company profiles, peer data, news, stock prices |
| Crypto Data + Prices | CoinGecko (free tier) | Top Gainers/Losers + crypto prices; no API key required |
| US Brokerage (execution) | Alpaca (paper + live) | Automated holdings fetch and order execution |
| Crypto Brokerage (fetch only) | BITKUB (public REST API) | Automated holdings fetch; execution deferred to v2.0 |
| Thai Equities (fetch only) | Settrade Open API / InnovestX | Automated holdings fetch; execution deferred to v2.0 |
| Transactional Email | Resend (free tier) | Daily drift digest email; 3,000 emails/month free; native Next.js integration |

### 5.3 Price Fetching Architecture

Prices are never entered manually. Three-tier strategy:

| Tier | Applies To | Source | Cache TTL |
|---|---|---|---|
| Tier 1a | Alpaca silos | Alpaca API at sync time | Updated on each manual sync |
| Tier 1b | BITKUB silos | BITKUB `/api/market/ticker` | 15 minutes (shared global cache) |
| Tier 2 | Manual silos — stocks/ETFs | Finnhub `/quote` | 15 minutes (shared global cache) |
| Tier 3 | Manual silos — crypto | CoinGecko `/simple/price` | 15 minutes (shared global cache) |

**Asset Mapping:** When a user adds an asset to a manual silo, they type a name or ticker. The app queries Finnhub (stocks) or CoinGecko (crypto) and presents a ranked list. The user confirms the correct match. This confirmed mapping is stored permanently — the confirmation never repeats for the same asset in the same silo.

**Price history:** Not stored. `price_cache` holds only the most recent price per asset.

### 5.4 RAG Architecture (v2.0)

**Decision: Supabase pgvector with hybrid search (vector + keyword BM25)**

pgvector is already in the stack — zero additional vendor, zero additional cost. For a realistic financial knowledge base (50–500 documents), pgvector with HNSW indexing delivers sub-100ms latency. A 500-document corpus ≈ 30 MB — well within the 500 MB Supabase free-tier budget.

- Documents chunked using semantic splitting (split on topic-boundary similarity drop)
- Each chunk embedded using the user's configured LLM provider's embedding endpoint — embedding calls use the user's own API key
- Chunks stored in `knowledge_chunks` table with `embedding vector(1536)` and HNSW index
- Retrieval: cosine similarity search + optional keyword filter on `metadata` JSONB
- Default corpus: curated `.md` files in `/knowledge` directory shipped with the repo
- User uploads: stored in Supabase Storage, chunked and embedded on ingest

**v3.0 upgrade path:** LightRAG + Qdrant for graph-enhanced multi-hop reasoning if corpus exceeds 10,000 documents.

### 5.5 LLM Provider Architecture (v2.0)

The app supports both direct provider API keys and OpenRouter as a convenience gateway. **Direct provider keys are always supported and are never inferior to OpenRouter.** Users who have a free-tier API key from a direct provider (e.g., Google AI Studio free tier) pay nothing to use the Research Hub.

#### Direct Provider Support (5 providers)

| Provider | Free Tier Available | Free-Tier Model | API Key Source | Protocol |
|---|---|---|---|---|
| **Google (Gemini)** | Yes — Google AI Studio | Gemini 2.0 Flash | https://aistudio.google.com/app/apikey | OpenAI-compatible (`https://generativelanguage.googleapis.com/v1beta/openai/`) |
| **Groq** | Yes — generous free tier | Llama 3.3 70B, Llama 3.1 8B | https://console.groq.com/ | OpenAI-compatible (`https://api.groq.com/openai/v1`) |
| **OpenAI** | No free tier (paid only) | GPT-4o Mini (low cost) | https://platform.openai.com/api-keys | Native OpenAI SDK |
| **Anthropic** | No free tier (paid only) | Claude 3.5 Haiku (low cost) | https://console.anthropic.com/ | Custom SDK (requires `anthropic-version` header — special handling in backend) |
| **DeepSeek** | Yes — free tier with limits | DeepSeek-V3 | https://platform.deepseek.com/api_keys | OpenAI-compatible (`https://api.deepseek.com`) |

> **For zero-cost usage:** Users can use Google AI Studio (Gemini 2.0 Flash — free), Groq (Llama 3.3 70B — free), or DeepSeek (DeepSeek-V3 — free tier) with no spending required.

#### OpenRouter (Optional Convenience Gateway)

OpenRouter provides access to 400+ models from a single API key via a single OpenAI-compatible endpoint (`https://openrouter.ai/api/v1`). It is the recommended option for users who want access to many models without managing multiple keys. OpenRouter is **never required** — it is one option among six.

- Users supply one OpenRouter key to access any model in their catalogue
- Costs pass through to the user at provider rates — some models on OpenRouter are free
- Useful for users who already have an OpenRouter account or want model flexibility

#### Backend Implementation

```
LLM provider selection logic:
  if provider == 'anthropic':
    use Anthropic SDK with custom headers
  elif provider == 'openai':
    use OpenAI SDK with native base_url
  else (google, groq, deepseek, openrouter, mistral):
    use OpenAI SDK with provider-specific base_url
    (all are OpenAI-compatible)
```

The backend adapts to whichever provider the user has configured. No provider is hardcoded as a default — the user sets their preference in Settings, and the app routes all inference calls through their chosen provider and key.

**Key storage:** All LLM API keys stored encrypted at rest in Supabase `user_profiles`. Never returned in any API response. Never logged.

### 5.6 Data Ownership and Privacy

- All user portfolio data stored in Supabase under the user's account with RLS
- User-supplied API keys encrypted at rest; encryption key in Vercel environment variables only
- Application does not transmit portfolio data to third parties beyond executing a user-approved order
- **PDPA compliance (Thailand):** The hosted application will implement formal data controller requirements — a published privacy policy, a data processing register, a mechanism for users to request data deletion, and data minimisation practices. If the user base reaches a scale requiring formal registration with Thailand's PDPC, this will be completed prior to public launch.
- Email used only for authentication and daily drift digest notifications

---

## 6. Feature Specifications

### Feature 1: Portfolio Tracking & Rebalancing Engine

**F1-R1:** Support manual input of holdings quantities and cash balances for non-API platforms. Users enter quantities only — prices fetched automatically.

**F1-R2:** API integration with Alpaca (paper + live) for automated holdings fetch and order execution (v1.0). User approval via non-dismissible confirmation dialog required before any order is submitted.

**F1-R3:** Price fetching is automatic — Alpaca API for Alpaca silos, BITKUB API for BITKUB silos, Finnhub for manual stock/ETF silos, CoinGecko for manual crypto silos. 15-minute shared cache. Manual refresh always bypasses TTL.

**F1-R4:** Asset search and ticker confirmation: user types name/ticker → app queries Finnhub or CoinGecko → user confirms match → mapping stored permanently. Never repeated for same asset in same silo.

**F1-R5:** Sell-to-buy rebalancing mode with optional cash injection toggle. When target weights sum to less than 100%, persistent warning shown: "Your targets sum to X%. The remaining Y% will be held as cash after rebalancing."

**F1-R6:** Two rounding modes per session:
- **Partial Rebalance (default):** Buy orders round down, sell orders round up. Residual drift ±1–2%. One transaction per asset.
- **Full Rebalance:** Sells and re-buys to ±0.01% of target weights. Up to two transactions per asset. Warning: "This mode may generate additional transactions and higher brokerage fees."

**F1-R7:** Pre-flight balance validation before any order is presented. Fails fast with specific constraint surfaced to user.

**F1-R8:** Accuracy — Full Rebalance: ±0.01%. Partial Rebalance: up to ±2% residual drift acceptable.

**F1-R9:** All calculations and executions strictly isolated to their respective silo. No cross-silo math or execution.

**F1-R10:** Rebalancing sessions stored as immutable session blocks with full `snapshot_before` JSONB. Never updated after creation. Each new rebalance is a new session.

---

### Feature 2: Platform-Specific Account Silos

**F2-R1:** Users may create up to **5 active platform silos**. Each maps to exactly one real-world investment platform.

**F2-R2:** Each silo has an independently configurable base currency (e.g., USD for Alpaca, THB for BITKUB and DIME).

**F2-R3:** Rebalancing calculations and API executions strictly isolated within their silo.

**F2-R4:** Global overview displays a merged total. Same-ticker assets across silos appear combined in overview but remain independent per silo for rebalancing.

**F2-R5:** "Convert all to USD" toggle in global overview (default: off). Converts for display only using ExchangeRate-API (60-min TTL). Does not affect rebalancing calculations.

**F2-R6:** Portfolio Drift Indicator monitors each asset per silo independently. Daily digest alert when threshold breached. Delivery via in-app notification on next login, email (via Resend), or both — user configurable in Settings.

**F2-R7:** Supported platform silos and their v1.0 / v2.0 execution status:

| Platform | v1.0 | v2.0 |
|---|---|---|
| Alpaca | Holdings fetch + order execution | — |
| BITKUB | Holdings fetch only | Order execution added |
| InnovestX | Holdings fetch only | Order execution added |
| Charles Schwab | Holdings fetch only | Order execution added |
| Webull | Holdings fetch only | Order execution added |
| DIME | Manual entry only | Manual entry only (permanent — no API) |
| All others | Manual entry only | Manual entry only |

---

### Feature 3: AI-Powered Qualitative Research Hub ("The Trust Engine") — v2.0

**F3-R1:** Research sessions triggered by: (a) manual ticker search from Discover page or Research Hub; (b) selecting an asset from portfolio holdings.

**F3-R2:** RAG knowledge base ships with default `.md` files in `/knowledge` directory. Users may upload additional documents. Chunks stored in Supabase with pgvector.

**F3-R3:** Requires a valid LLM API key in Settings. Supported providers and their free-tier options:
- Google AI Studio key → Gemini 2.0 Flash (free)
- Groq key → Llama 3.3 70B (free)
- DeepSeek key → DeepSeek-V3 (free tier)
- OpenAI key → GPT-4o Mini (paid)
- Anthropic key → Claude 3.5 Haiku (paid)
- OpenRouter key → 400+ models (paid per token; some free models available)

If no key is configured, all AI features display: "To use the Research Hub, add your LLM API key in Settings."

**F3-R4:** Output: structured cards with expandable text — Sentiment Score (bullish/neutral/bearish + confidence), Key Risk Factors (bulleted), Narrative Summary (150–300 words).

**F3-R5:** AI must never recommend a specific target weight percentage. Enforced at system prompt level.

**F3-R6:** Persistent disclaimer on all AI surfaces: "This platform provides data aggregation and decision-support only. Nothing on this page constitutes financial advice. Consult a licensed financial advisor before making investment decisions."

**F3-R7:** Research sessions cached per user in Supabase. Re-fetched only on explicit user refresh.

---

### Feature 4: Contextual News Feed

**F4-R1:** News data sourced from Finnhub and FMP free-tier endpoints.

**F4-R2:** Two tabs: Portfolio News (filtered to holdings) and Macro News (general market).

**F4-R3:** Portfolio News two-tier matching — Tier 1: exact ticker + company name; Tier 2: enriched tags from Finnhub company profile endpoint.

**F4-R4:** Articles cached globally per ticker (24-hour database retention; 15-minute window is a rate-limit guard on POST /api/news/refresh only — see docs/prd/features/F4-news-feed.md for the authoritative definition). Per-user read/dismiss state stored separately.

**F4-R5:** Refresh exclusively user-triggered. Runs asynchronously without blocking other page features.

**F4-R6:** Refresh latency: under 3 seconds.

**F4-R7:** Rate limit degradation: show last cached articles with "Rate limit reached — showing articles last updated [timestamp]" notice and direct source link.

---

### Feature 5: Asset Discovery & Monitoring

**F5-R1:** Display 5–8 related assets for any portfolio asset or Discover page search. Engine: Finnhub `/stock/peers` (default), static `sector_taxonomy.json` (offline fallback).

**F5-R2:** Each peer card: ticker, company name, current price. If LLM key configured (v2.0): "AI Insight" tag — max 12 words explaining the relationship.

**F5-R3:** Top Gainers / Top Losers — US Stocks (Finnhub/FMP) and Crypto (CoinGecko) sections. Other exchanges out of scope for v1.0.

**F5-R4:** Portfolio Drift Indicator: current weight vs target weight per asset per silo. Three-state visual: green (within threshold), yellow (within 2% of threshold value), red (exceeded). Drift is current-snapshot only — no historical drift stored.

**F5-R5:** Daily digest alert when threshold exceeded. Delivery: in-app on next login, email via Resend, or both — user configurable.

---

## 7. External Dependencies & Failure Modes

| Dependency | Usage | Free Tier Limit | Failure Behaviour |
|---|---|---|---|
| Finnhub | News, profiles, peer data, stock prices | 60 calls/min | Show last cached data + timestamp + source link |
| FMP | News, fundamentals fallback | 250 calls/day | Fall back to Finnhub-only; show notice |
| CoinGecko | Crypto prices, Top Gainers/Losers | 30 calls/min | Show last cached data + stale timestamp |
| ExchangeRate-API | USD conversion toggle (60-min TTL) | 1,500 calls/month | Disable USD toggle; show "FX data unavailable" |
| Alpaca | Holdings fetch + order execution | Unlimited (free paper) | Show "Broker connection unavailable"; calculator works with last state |
| BITKUB | Holdings fetch (v1.0) | Rate limits apply | Show "Exchange connection unavailable"; manual entry still works |
| Settrade / InnovestX | Thai equity holdings fetch | Rate limits apply | Show "Broker connection unavailable"; manual entry still works |
| Schwab | Holdings fetch (v1.0) | Rate limits apply | Prompt re-authentication if token expired; manual entry fallback |
| Webull | Holdings fetch (v1.0) | Rate limits apply | Show "Broker connection unavailable"; manual entry fallback |
| Supabase | Database, auth, vector store, caches | 500 MB / 50,000 MAU | Full service degradation; show maintenance page |
| Vercel | Frontend + API routes | 100 GB bandwidth/month | Standard Vercel error page |
| Resend | Drift digest email | 3,000 emails/month | Skip email delivery; in-app notification still fires |
| LLM Provider (v2.0) | Research Hub inference | User-funded | Show "API key error or quota exceeded" with Settings link |

---

## 8. Non-Functional Requirements

### 8.1 Performance

| Metric | Target |
|---|---|
| Rebalancing calculation render time | < 2 seconds (up to 50 holdings) |
| News feed refresh time | < 3 seconds per tab |
| Price cache TTL | 15 min (stocks + crypto); 60 min (FX rates) |
| Page first load | < 3 seconds on standard broadband |
| PWA offline load (cached state) | < 1 second |
| Order confirmation dialog | Synchronous — no background delay |

### 8.2 Availability & Offline

- PWA. After first load, core features (portfolio view, rebalancing calculator using last-known state, drift indicator) must function without internet connection.
- Features unavailable offline (live prices, news, order execution) display clear offline indicators, not errors.

### 8.3 Security

- All API keys (Alpaca, BITKUB, InnovestX, Schwab, Webull, LLM providers) stored encrypted at rest. Never in logs, URL parameters, or error messages.
- All brokerage and LLM calls proxied through Next.js API routes. Keys never exposed to browser.
- Auth: Supabase Auth email + password. Password reset via email link only.

### 8.4 Browser & Device Support

- Full support: Chrome (latest 2), Safari (latest 2), Firefox (latest 2)
- Mobile: responsive from 375px viewport. PWA installable on iOS and Android.
- No Internet Explorer support.

---

## 9. Monetisation Strategy (Future — Not Implemented)

> Rebalancify is and will remain open-source. The following is documented for academic discussion only.

**1. Freemium — hosted tier limits**
The free hosted instance enforces the 5-silo limit. A Pro plan removes limits and adds scheduled rebalancing. Self-hosters always get unlimited usage.

**2. Pre-built knowledge base subscription**
The Research Hub ships with basic `.md` files. A paid subscription provides a regularly updated, curated knowledge base of financial literature summaries and sector research.

**3. Managed hosting for non-technical users**
One-click hosted instance for users who want a private Rebalancify deployment without managing infrastructure.

**4. Open-core model**
Core features open-source. A closed-source "Rebalancify Pro" binary adds: automated scheduled rebalancing, email reports, multi-user (household) accounts, and priority support.

**Why not ads:** Conflicts with transparency and user autonomy core values.

---

## 10. Key Decision Log

| # | Decision | Outcome | Rationale |
|---|---|---|---|
| 1 | Deployment model | Hosted production + open-source GitHub | Satisfies academic requirement; preserves open-source ethos |
| 2 | Rebalancing mode | Sell-to-buy with optional cash injection toggle | Covers both pure rebalancing and cash-deployment |
| 3 | Rounding | Partial (default) vs Full — user picks per session | Balances fee cost vs accuracy |
| 4 | Cross-platform same asset | Merged in overview; isolated per silo for rebalancing | Prevents cross-account math errors |
| 5 | Currency model | Per-silo currency + optional USD display toggle | Respects silo isolation; global view still possible |
| 6 | RAG system | Supabase pgvector with hybrid search | Zero additional vendor; sufficient for realistic corpus; already in stack |
| 7 | LLM BYOK architecture | 5 direct providers + OpenRouter as optional gateway | Direct keys are always supported; free-tier users pay nothing |
| 8 | Free-tier LLM options | Google AI Studio (Gemini 2.0 Flash), Groq (Llama 3.3 70B), DeepSeek V3 | Three zero-cost paths for users who cannot spend money |
| 9 | Related assets engine | Finnhub Peers + static sector fallback | Accurate without LLM; offline capable |
| 10 | Top Gainers/Losers scope | US Stocks (Finnhub/FMP) + Crypto (CoinGecko) | Covers primary asset classes within free-tier |
| 11 | Drift delivery | Daily digest via Resend (free tier); user chooses in-app / email / both | Resend is current best practice for Vercel-hosted Next.js apps |
| 12 | AI output restriction | No target weight recommendations; sentiment + risk factors only | Regulatory risk mitigation |
| 13 | Price fetching architecture | Alpaca API / BITKUB API / Finnhub / CoinGecko by asset type | Correct source per asset type; users never enter prices |
| 14 | Asset ticker mapping | Confirmed once at asset creation; stored permanently | One-time friction eliminates ongoing price-matching errors |
| 15 | News caching | Global shared cache per ticker (24h DB retention; 15-min rate-limit guard on refresh endpoint) + per-user read/dismiss state | Minimises API quota; personalisation preserved |
| 16 | Price caching | TTL cache (15 min); manual refresh always bypasses TTL | Balances quota conservation with UX freshness |
| 17 | Price history | Not stored | Rebalancify is a rebalancing tool, not a charting tool |
| 18 | Rebalancing session history | Immutable session blocks with full snapshot_before JSONB | External trades do not create false continuity |
| 19 | DIME integration | Manual silo only (permanent) | Mobile-only app; no public API; no plugin surface |
| 20 | BITKUB integration | Official REST API (HMAC-SHA256); holdings fetch v1.0; execution v2.0 | Public API confirmed; execution deferred for stability |
| 21 | Plugin architecture | Defined for future contributors; not shipped in v1.0 or v2.0 | Contribution path for platforms without public APIs |
| 22 | Silo limit | 5 active silos per user | Protects 500 MB Supabase free tier; sufficient for target persona |
| 23 | Execution scope v1.0 | Alpaca only | Well-documented API; paper + live; original plan; strong demo value |
| 24 | Execution scope v2.0 | BITKUB, InnovestX, Schwab, Webull | Groups all non-Alpaca execution into one release for a clean story |
| 25 | Transactional email | Resend free tier (3,000 emails/month) | Best practice for Vercel + Next.js; generous free tier; simple API |
| 26 | PDPA compliance | Formal data controller posture implemented at launch | Thai users are in scope; privacy policy + data deletion mechanism required |
| 27 | OpenRouter as optional | OpenRouter recommended but never required | Users with free-tier direct keys (Google, Groq, DeepSeek) pay nothing |

---

## 11. Open Questions

All open questions from v1.2 are now closed.

| # | Question | Resolution |
|---|---|---|
| OQ-1 | PDPA compliance | Formal data controller posture implemented. Privacy policy, data register, deletion mechanism at launch. |
| OQ-2 | Article read-status tracking | Global cache + per-user read/dismiss state (implemented in data model). |
| OQ-3 | Maximum number of silos | 5 active silos per user. |
| OQ-4 | BITKUB execution version | v2.0 (same as all non-Alpaca platforms). |
| OQ-5 | Transactional email provider | Resend free tier — locked. |
| OQ-6 | OpenRouter exclusive or parallel | Direct provider keys always supported; OpenRouter is optional. |

---

## 12. Glossary

| Term | Definition |
|---|---|
| Asset Silo | A user-defined portfolio container that maps 1:1 to a single real-world investment platform. Maximum 5 per user account. |
| Asset Mapping | A stored link between a user's local asset reference and the confirmed canonical ticker used for price fetching. Created once per asset per silo. |
| Target Weight | The user-defined percentage of a silo's total value that should be allocated to a specific asset. |
| Portfolio Drift | The deviation between an asset's current weight and its target weight, expressed as a percentage point difference. |
| Cash Injection | An optional rebalancing session parameter where the user specifies a cash amount to deploy in addition to sell proceeds. |
| Price Cache TTL | Maximum age of a cached price before re-fetch. 15 minutes for stocks and crypto; 60 minutes for FX rates. |
| Partial Rebalance | Rounding mode that minimises transactions. Residual drift of ±1–2% expected. |
| Full Rebalance | Rounding mode that achieves exact target weights (±0.01%) at the cost of additional transactions. |
| Sell-to-Buy | Rebalancing strategy where proceeds from selling overweight assets fund the purchase of underweight assets. |
| RAG | Retrieval-Augmented Generation — grounds LLM responses in a user-provided document corpus. |
| pgvector | PostgreSQL extension enabling vector similarity search. Used for RAG in Supabase. |
| PWA | Progressive Web App — installable on mobile and desktop with offline capability. |
| Trust Engine | Internal name for the AI-Powered Qualitative Research Hub (v2.0). |
| BYOK | Bring Your Own Key — users supply their own API keys for LLM providers. |
| OpenRouter | Optional unified LLM gateway providing 400+ models via one OpenAI-compatible key. Never required. |
| HMAC-SHA256 | Cryptographic signing algorithm used by BITKUB and InnovestX for API request authentication. |
| Manual Silo | A platform silo where holdings are entered by the user (quantities only). Used for platforms without a public API such as DIME. |
| Resend | Transactional email provider used for daily drift digest notifications. |
| Data Controller | Under PDPA (Thailand) and GDPR, the entity that determines the purpose and means of processing personal data. Rebalancify is a data controller for its hosted users. |
