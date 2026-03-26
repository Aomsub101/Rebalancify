# docs/architecture/05-build-order.md — Feature Build Order & Dependency Map

## AGENT CONTEXT

**What this file is:** The authoritative build sequence. Every story depends on tasks completed before it. Never start a phase before its prerequisite phases are complete.
**Derived from:** TECH_DOCS_v1.2.md (DOC-05 Build Order)
**Connected to:** PROGRESS.md (tracks what is complete), stories/EPIC-*/STORY-*.md (implement these tasks)
**Critical rules for agents using this file:**
- This file defines the implementation order. Do not reorder phases.
- Phase 2 (Alpaca execution) must complete before Phase 9 (multi-platform execution).
- Phase 3 (non-Alpaca fetch) must complete before Phase 9 (non-Alpaca execution).
- Phase 8 (AI Research Hub) must complete before Phase 9 — v2.0 release sequencing. The encrypted key infrastructure was established in Phase 2, not Phase 8.
- Never start Phase 8 without Phase 0.2 (all migrations) and Phase 2.1 (key encryption pattern) complete.

---

## Phase 0 — Foundation (EPIC-01)

| # | Task | Story | Depends On | Produces |
|---|---|---|---|---|
| 0.1 | Supabase project: enable pgvector, pg_cron, RLS defaults | STORY-001 | — | Live Supabase instance |
| 0.2 | Run all migrations from schema doc in dependency order (including v2.0 tables) | STORY-001 | 0.1 | Full schema live |
| 0.3 | Auth trigger: auto-create user_profiles on signup | STORY-001 | 0.2 | Auth-profile linkage |
| 0.4 | Next.js scaffold: App Router, Tailwind, Supabase client, React Query, TypeScript | STORY-002 | — | Dev environment |
| 0.5 | Vercel deployment + environment variables | STORY-004 | 0.4 | Deployment pipeline |
| 0.6 | Auth pages: login, signup, reset-password | STORY-002 | 0.3, 0.4 | Working auth flow |
| 0.7 | Auth middleware: protect /dashboard routes, redirect unauthenticated users | STORY-002 | 0.6 | Route guard |
| 0.8 | AppShell: Sidebar, TopBar, SessionContext, OfflineBanner | STORY-003 | 0.7 | Authenticated shell |

---

## Phase 1 — Silos & Holdings Core (EPIC-02)

| # | Task | Story | Depends On | Produces |
|---|---|---|---|---|
| 1.1 | GET/PATCH /api/profile (display name + notification channel only — no API key handling yet) | STORY-005 | 0.2, 0.7 | Profile endpoints |
| 1.2 | Settings page: display name + notification channel section | STORY-005 | 1.1, 0.8 | Basic settings UI |
| 1.3 | GET/POST/PATCH/DELETE /api/silos (with 5-silo limit check on POST) | STORY-005 | 0.2, 0.7 | Silo CRUD |
| 1.4 | Silos list page + Create silo form (all platform_type options + correct default currencies) | STORY-005 | 1.3, 0.8 | Silo UI |
| 1.5 | GET /api/assets/search (Finnhub for stocks; CoinGecko for crypto) | STORY-006 | 0.7 | Asset search |
| 1.6 | POST /api/silos/:id/asset-mappings (upsert assets table + create mapping) | STORY-006 | 0.2, 1.5 | Asset mapping |
| 1.7 | Price fetch service: check price_cache_fresh → Finnhub/CoinGecko → upsert price_cache | STORY-006 | 0.2 | Price cache |
| 1.8 | GET /api/silos/:id/holdings with all derived fields (current_price, current_weight_pct, drift_pct, stale_days) | STORY-007 | 0.2, 1.6, 1.7 | Holdings read |
| 1.9 | POST + PATCH /api/silos/:id/holdings (manual entry, quantity + cost_basis edit) | STORY-007 | 0.2, 1.6 | Holdings write |
| 1.10 | PUT /api/silos/:id/target-weights (atomic replacement, sum-warning logic) | STORY-008 | 0.2, 1.6 | Weight save |
| 1.11 | Silo detail page: HoldingsTable, CashBalanceRow, WeightsSumBar, AssetSearchModal | STORY-007, STORY-008 | 1.8–1.10, 0.8 | Core silo UI |
| 1.12 | Staleness warning (StalenessTag on HoldingRow — > 7 days for manual silos) | STORY-007 | 1.11 | Data freshness UX |

---

## Phase 2 — Alpaca Integration: Fetch + Execution (EPIC-03)

| # | Task | Story | Depends On | Produces |
|---|---|---|---|---|
| 2.1 | PATCH /api/profile: Alpaca key/secret encryption + storage | STORY-009 | 1.1 | Secure key storage |
| 2.2 | Settings page: Alpaca section (key inputs masked, paper/live mode, connection status) | STORY-009 | 2.1, 1.2 | Alpaca setup UI |
| 2.3 | POST /api/silos/:id/sync for Alpaca: fetch positions + account cash | STORY-009 | 2.1, 1.9 | Alpaca sync |
| 2.4 | POST /api/silos/:id/rebalance/calculate: partial + full mode, cash toggle, pre-flight validation | STORY-010 | 1.7, 1.8, 1.10 | Calculation endpoint |
| 2.5 | POST /api/silos/:id/rebalance/execute for Alpaca: submit to Alpaca API + store order IDs | STORY-011 | 2.4, 2.3 | Alpaca execution |
| 2.6 | GET /api/silos/:id/rebalance/history + GET /api/rebalance/history | STORY-012 | 0.2 | History endpoints |
| 2.7 | Rebalancing page: full 3-step wizard (config, order review, result) | STORY-011 | 2.4, 2.5, 0.8 | Full rebalancing UI |
| 2.8 | Rebalance history page | STORY-012 | 2.6, 0.8 | History UI |
| 2.9 | Silo detail: SyncButton (Alpaca silos), last_synced_at, AlpacaLiveBadge | STORY-009 | 2.3, 1.11 | Sync + live mode UI |

---

## Phase 3 — Non-Alpaca Holdings Fetch (EPIC-04)

| # | Task | Story | Depends On | Produces |
|---|---|---|---|---|
| 3.1 | PATCH /api/profile: BITKUB + InnovestX + Schwab OAuth + Webull key storage | STORY-013, STORY-014, STORY-015, STORY-016 | 2.1 | Multi-broker key storage |
| 3.2 | POST /api/silos/:id/sync for BITKUB (wallet + ticker) | STORY-013 | 3.1, 1.9 | BITKUB sync |
| 3.3 | Price cache update from BITKUB ticker data | STORY-013 | 3.2, 1.7 | BITKUB prices |
| 3.4 | POST /api/silos/:id/sync for InnovestX (Settrade SDK + digital assets) | STORY-014 | 3.1, 1.9 | InnovestX sync |
| 3.5 | Schwab OAuth flow: connect, token exchange, token storage, expiry detection | STORY-015 | 3.1, 1.1 | Schwab auth |
| 3.6 | POST /api/silos/:id/sync for Schwab (accounts endpoint) | STORY-015 | 3.5, 1.9 | Schwab sync |
| 3.7 | POST /api/silos/:id/sync for Webull (positions + balance) | STORY-016 | 3.1, 1.9 | Webull sync |
| 3.8 | Settings page: BITKUB, InnovestX, Schwab OAuth, Webull sections | STORY-016 | 3.1–3.7, 1.2 | Full broker settings |
| 3.9 | Rebalancing page: ExecutionModeNotice for non-Alpaca silos (persistent banner) | STORY-016 | 2.7 | Manual execution UX |

---

## Phase 4 — Drift & Overview (EPIC-05)

| # | Task | Story | Depends On | Produces |
|---|---|---|---|---|
| 4.1 | GET /api/silos/:id/drift (three-state computation: green/yellow/red) | STORY-017 | 1.7, 1.8, 1.10 | Drift endpoint |
| 4.2 | DriftBadge component (green/yellow/red with icon + formatted drift_pct) | STORY-017 | — | Reusable component |
| 4.3 | DriftCell in HoldingsTable + DriftMiniRow in DiscoverPage | STORY-017 | 4.1, 4.2, 1.11 | Drift in silo UI |
| 4.4 | GET /api/fx-rates (ExchangeRate-API, 60-min TTL) | STORY-018 | 0.2 | FX endpoint |
| 4.5 | Overview page: PortfolioSummaryCard, SiloCardList, GlobalDriftBanner, USDToggle, SiloCountBadge | STORY-019 | 4.1, 4.4, 0.8 | Overview UI |
| 4.6a | pg_cron job (migration 17): check drift thresholds, INSERT into notifications table | STORY-020 | 4.1 | In-app drift alerts |
| 4.6b | Vercel Cron Job at /api/cron/drift-digest: query breaches, call Resend SDK for email digest | STORY-020 | 4.1, Resend SDK | Drift digest email |

---

## Phase 5 — News Feed (EPIC-06)

| # | Task | Story | Depends On | Produces |
|---|---|---|---|---|
| 5.1 | News fetch service: Finnhub + FMP, upsert news_cache, rate limit handling + stale fallback | STORY-021 | 0.2 | News cache service |
| 5.2 | GET /api/news/portfolio (two-tier ticker matching) | STORY-022 | 5.1, 1.8 | Portfolio news |
| 5.3 | GET /api/news/macro | STORY-022 | 5.1 | Macro news |
| 5.4 | POST /api/news/refresh (manual re-fetch, bypasses TTL) | STORY-021 | 5.1 | Manual refresh |
| 5.5 | PATCH /api/news/articles/:id/state (read/dismiss) | STORY-021 | 0.2 | Article state |
| 5.6 | News page: NewsTabs, RefreshBar, RateLimitBanner, ArticleList, ArticleCard | STORY-023 | 5.2–5.5, 0.8 | Full news UI |
| 5.7 | pg_cron: purge news_cache rows older than 24 hours | STORY-021 | 0.2 | Storage management |

---

## Phase 6 — Asset Discovery (EPIC-07)

| # | Task | Story | Depends On | Produces |
|---|---|---|---|---|
| 6.1 | GET /api/assets/:id/peers (Finnhub peers + static sector_taxonomy.json fallback) | STORY-024 | 0.2, 1.7 | Peers endpoint |
| 6.2 | GET /api/market/top-movers (Finnhub/FMP stocks + CoinGecko crypto) | STORY-025 | 1.7 | Top movers |
| 6.3 | Discover page: TopMoversTabs, AssetPeerSearch, PeerCard, PortfolioDriftSummary | STORY-026 | 6.1, 6.2, 4.1, 0.8 | Discovery UI |

---

## Phase 7 — PWA & Polish (EPIC-08)

| # | Task | Story | Depends On | Produces |
|---|---|---|---|---|
| 7.1 | next-pwa: service worker config, manifest.json, offline caching strategy | STORY-027 | All phases | PWA support |
| 7.2 | OfflineBanner (already in AppShell) + disable live features gracefully when offline | STORY-027 | 7.1 | Offline UX |
| 7.3 | Onboarding modal: platform picker, one-time first-login display, silo pre-creation | STORY-028 | 1.3, 0.8 | Onboarding flow |
| 7.4 | Progress banner: post-onboarding, localStorage dismiss, step indicators | STORY-028 | 7.3 | Post-onboarding UX |
| 7.5 | LoadingSkeleton audit: verify all data-fetching components have skeletons | STORY-029 | All UI phases | Loading UX complete |
| 7.6 | ErrorBanner audit: verify all API-dependent components have error states | STORY-029 | All UI phases | Error UX complete |
| 7.7 | Performance audit: calc < 2s, news < 3s, first load < 3s, PWA offline < 1s | STORY-029 | 7.1 | NFR targets met |

---

## Phase 8 — AI Research Hub (v2.0) (EPIC-09)

| # | Task | Story | Depends On | Produces |
|---|---|---|---|---|
| 8.1 | (Tables already migrated in Phase 0) Verify knowledge_chunks + research_sessions exist | STORY-030 | 0.2 | v2.0 tables ready |
| 8.2 | PATCH /api/profile: LLM provider + key + model (6 providers, encryption pattern from 2.1) | STORY-030 | 2.1 | LLM key storage |
| 8.3 | Settings page: LLMSection (provider selector, model selector, key input, free-tier labels) | STORY-030 | 8.2, 1.2 | LLM settings UI |
| 8.4 | Document ingest pipeline: upload → semantic chunk → embed (user's provider) → store in knowledge_chunks | STORY-031 | 0.2, 8.2 | RAG ingest |
| 8.5 | POST /api/research/:ticker: pgvector similarity search + LLM inference routing (all 6 providers) | STORY-032 | 8.2, 8.4, 1.5 | Research endpoint |
| 8.6 | Research page: LLMKeyGate, structured cards (sentiment, risk factors, narrative), persistent disclaimer | STORY-033 | 8.5, 0.8 | Research UI |
| 8.7 | GET /api/assets/:id/peers: populate AiInsightTag if llm_connected (v2.0 extension) | STORY-033 | 8.2, 6.1 | AI-enriched peers |
| 8.8 | Default /knowledge .md files shipped with repository | STORY-031 | — | Default RAG corpus |

---

## Phase 9 — Multi-Platform Execution (v2.0) (EPIC-10)

| # | Task | Story | Depends On | Produces |
|---|---|---|---|---|
| 9.1 | POST /api/silos/:id/rebalance/execute for BITKUB: place-bid/place-ask | STORY-034 | 3.2, 2.4 | BITKUB execution |
| 9.2 | POST /api/silos/:id/rebalance/execute for InnovestX: Settrade order placement | STORY-035 | 3.4, 2.4 | InnovestX execution |
| 9.3 | POST /api/silos/:id/rebalance/execute for Schwab: order placement endpoint | STORY-036 | 3.6, 2.4 | Schwab execution |
| 9.4 | POST /api/silos/:id/rebalance/execute for Webull: order placement endpoint | STORY-037 | 3.7, 2.4 | Webull execution |
| 9.5 | Update ExecutionResultPanel: remove MANUAL badge for newly automated platforms | STORY-038 | 9.1–9.4, 2.7 | Execution UX updated |
| 9.6 | Update Settings page: remove manual-only notices for newly automated platforms | STORY-039 | 9.1–9.4, 3.8 | Settings UX updated |

---

## Hard Dependency Rules

1. Phase 2 (Alpaca execution) must be complete before Phase 9 (multi-platform execution) — Phase 9 reuses the execute endpoint pattern.
2. Phase 3 (non-Alpaca fetch) must be complete before Phase 9 — sync must work before execution.
3. Phase 8 (AI Research Hub) must complete before Phase 9 for v2.0 release sequencing. There is no shared infrastructure dependency — the encrypted key pattern was established in Phase 2 (STORY-009) and broker credentials were stored in Phase 3. The sequencing is a product decision: the full v2.0 release ships Phase 8 and Phase 9 together.
4. Never start Phase 8 without Phase 0.2 (all migrations) and Phase 2.1 (key encryption pattern) complete.
5. v2.0 tables (`knowledge_chunks`, `research_sessions`) are migrated in Phase 0.2 — they exist from day one but are unused until Phase 8.
