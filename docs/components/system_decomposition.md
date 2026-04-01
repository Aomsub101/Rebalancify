    

# DOCS/components/system_decomposition.md — As-Built Component Decomposition

## Purpose

This document defines the logical architecture components of Rebalancify, derived from the implemented epics and PRD feature specifications. It serves as the authoritative component map for the codebase.

---

## Component 1 — Auth & Foundation

**Technical Role**

The foundational layer that establishes the entire application stack. It bootstraps the Supabase project (PostgreSQL schema, RLS policies, pgvector extension), scaffolds the Next.js 15 application, implements JWT-based authentication via Supabase Auth, and provides the authenticated AppShell layout with session state via React Context.

**Belongs To**

- EPIC-01 — Foundation (STORY-001 through STORY-004)

**Key Responsibilities**

- All database migrations (Supabase schema, tables, policies)
- Authentication pages (login, signup, reset-password)
- AppShell layout wrapping all authenticated routes
- SessionContext for global UI state (session, USD toggle, silo count)
- Vercel deployment pipeline configuration
- Environment variable management via Vercel CLI

**Interaction With Other Components**

- All other components depend on Auth & Foundation — the AppShell is the immutable parent of every authenticated page
- SessionContext values (USD toggle, silo count) are consumed by Portfolio Data Layer, Rebalancing Engine, and Discovery components

---

## Component 2 — Portfolio Data Layer

**Technical Role**

The core data management layer for portfolio silos, holdings, and target weights. It provides the silo CRUD API routes, asset search and ticker confirmation, manual holdings entry, target weights editor, drift calculation engine, and FX rate fetching. This component is the source of truth for all portfolio state.

**Belongs To**

- EPIC-02 — Silos & Holdings (STORY-005 through STORY-008)
- EPIC-05 — Drift & Overview (STORY-017, STORY-018, STORY-019, STORY-020)

**Key Responsibilities**

- Silo CRUD with 5-silo enforcement per user
- Asset search via Finnhub (stocks/ETFs) and CoinGecko (crypto)
- Ticker confirmation with permanent mapping per silo
- Manual holdings CRUD with staleness detection
- Target weights editor with sum validation
- Drift calculation (three-state badge logic)
- FX rates endpoint (ExchangeRate-API, 60-min TTL)
- USD conversion toggle (display-only)
- Global Overview aggregation across all silos
- Daily drift digest via Resend + pg_cron

**Interaction With Other Components**

- Consumed by Rebalancing Engine (Component 3) — the engine reads holdings, prices, and weights from this layer
- Feeds the News Feed (Component 6) with portfolio ticker list for two-tier filtering
- Feeds the Asset Discovery (Component 7) with per-silo drift data
- Market Data (Component 5) is called by this component for price_cache and fx_rates
- Broker Integration (Component 4) populates holdings via sync endpoints that feed into this layer

---

## Component 3 — Rebalancing Engine

**Technical Role**

The deterministic order calculation and execution layer. It computes buy/sell orders to bring a silo to target weights, creates immutable session snapshots, validates pre-flight balance constraints, executes Alpaca orders (v1.0), and surfaces the 3-step rebalancing wizard UI. This is the computational heart of Rebalancify.

**Belongs To**

- EPIC-03 — Alpaca Integration (STORY-009 through STORY-012)

**Key Responsibilities**

- Alpaca API key encrypted storage (AES-256-GCM) and sync endpoint
- Rebalance calculator — partial mode (round down buys, round up sells) and full mode (±0.01% accuracy)
- Sell-to-buy mode with optional cash injection
- Immutable rebalance_sessions with snapshot_before JSONB
- Pre-flight balance validation (cash coverage, share availability)
- Alpaca order execution with non-dismissible ConfirmDialog
- 3-step wizard UI: Config → Review → Result
- Rebalance history endpoint and UI
- Execution result panel (Alpaca results, manual instructions)

**Interaction With Other Components**

- Reads from Portfolio Data Layer (Component 2) — all holdings, weights, and prices flow through its API routes
- Writes rebalance_orders and rebalance_sessions to Supabase (belongs to Portfolio Data Layer's schema)
- AlpacaLiveBadge consumed from this component by AppShell and Overview (Component 2)

---

## Component 4 — Broker Integration Layer

**Technical Role**

Handles automated holdings fetch and order execution for non-Alpaca platforms (BITKUB, InnovestX, Charles Schwab, Webull). It provides OAuth token management for Schwab, API key encrypted storage for all brokers, sync endpoints that populate the Portfolio Data Layer, and automated execution routes that extend the Rebalancing Engine's execute pattern.

**Belongs To**

- EPIC-04 — Broker Fetch (STORY-013 through STORY-016)
- EPIC-10 — Multi-Platform Execution (STORY-034 through STORY-039)

**Key Responsibilities**

- BITKUB holdings sync (wallet + ticker prices)
- InnovestX sync (Settrade equity branch + digital asset branch)
- Charles Schwab OAuth flow with 7-day token refresh
- Webull holdings sync
- Broker settings UI (all four platforms)
- BITKUB automated order execution (v2.0)
- InnovestX automated order execution (v2.0)
- Schwab automated order execution (v2.0)
- Webull automated order execution (v2.0)
- Remove MANUAL badge from newly automated platforms (UI cleanup)

**Interaction With Other Components**

- Populates holdings in the Portfolio Data Layer (Component 2) via sync endpoints
- Extends the Rebalancing Engine (Component 3) execute pattern for all non-Alpaca platforms
- Shares the Alpaca AES-256-GCM encryption pattern from EPIC-03 for broker key storage
- Settings UI consumed jointly with Portfolio Data Layer settings section

---

## Component 5 — Market Data & Pricing

**Technical Role**

A cross-cutting infrastructure component responsible for all external price and market data. It implements the three-tier price-fetching strategy (Alpaca API, BITKUB ticker, Finnhub, CoinGecko), manages the global price_cache and fx_rates tables, and surfaces market data for US stocks and crypto movers. This component is invoked by Portfolio Data Layer, Rebalancing Engine, Broker Integration, and Asset Discovery — but is not an epic unto itself; it is distributed across EPIC-02, EPIC-04, EPIC-05, and EPIC-07.

**Belongs To**

- EPIC-05 — Drift & Overview (STORY-017, STORY-018)
- EPIC-07 — Asset Discovery (STORY-024, STORY-025)
- Shared responsibility in EPIC-02 and EPIC-04

**Key Responsibilities**

- Three-tier price fetching with 15-min TTL cache
- Alpaca price sync (Tier 1a — at sync time)
- BITKUB ticker fetch (Tier 1b — 15-min cache)
- Finnhub quote fetch (Tier 2 — stocks/ETFs, 15-min cache)
- CoinGecko simple price (Tier 3 — crypto, 15-min cache)
- FX rates via ExchangeRate-API (60-min TTL)
- price_cache_fresh view for cache staleness checks
- Top Gainers/Losers (Finnhub/FMP for US stocks, CoinGecko for crypto)

**Interaction With Other Components**

- Called as a service layer by Portfolio Data Layer (drift calculation, holdings display)
- Called by Rebalancing Engine (Component 3) for all price lookups during order calculation
- Called by Broker Integration (Component 4) during holdings sync
- Called by Asset Discovery (Component 7) for peer prices and top movers

---

## Component 6 — News Feed

**Technical Role**

A user-triggered news aggregation and delivery layer. It fetches from Finnhub and FMP with rate-limit handling, caches articles globally in news_cache, manages per-user read/dismiss state, and surfaces a two-tab news UI (Portfolio News and Macro News). All refreshes are explicit user actions — no background polling.

**Belongs To**

- EPIC-06 — News Feed (STORY-021, STORY-022, STORY-023)

**Key Responsibilities**

- News fetch service with Finnhub (60 calls/min) and FMP (250 calls/day) rate-limit handling
- Global news_cache with 24-hour retention (pg_cron purge)
- Per-user article state (read/dismiss) in user_article_state table
- Two-tier portfolio news filtering (exact ticker match + enriched tag matching)
- Macro news (non-portfolio-filtered)
- News page UI: ArticleCard, ArticleList, RefreshBar, RateLimitBanner
- Graceful degradation: show cached data on rate limit, not an error screen

**Interaction With Other Components**

- Reads portfolio tickers from Portfolio Data Layer (Component 2) for portfolio news filtering
- Consumes Market Data (Component 5) indirectly via Finnhub/fmp calls

---

## Component 7 — Asset Discovery

**Technical Role**

Provides market exploration surfaces for non-portfolio assets. It surfaces peer assets per ticker (Finnhub peers + static sector taxonomy fallback), a Top Gainers/Losers dashboard for US stocks and crypto, and a portfolio drift summary view. The Discover page is the entry point for research queries.

**Belongs To**

- EPIC-07 — Asset Discovery (STORY-024, STORY-025, STORY-026)
- Partial EPIC-05 (drift mini summary on Discover page)

**Key Responsibilities**

- Peer assets endpoint (Finnhub /stock/peers with static sector_taxonomy.json fallback)
- Top Movers endpoint (Finnhub/FMP for US stocks, CoinGecko for crypto)
- Discover page UI: TopMoversTable, AssetPeerSearch, PeerResultsGrid, PortfolioDriftSummary
- AiInsightTag rendering on PeerCard (v2.0 only, gated on llm_connected)
- Drift mini summary per silo on Discover page

**Interaction With Other Components**

- Reads from Portfolio Data Layer (Component 2) for drift data and silo list
- Reads from Market Data (Component 5) for price data in peer cards and top movers
- Triggers Research (Component 8) via ticker search on Discover page

---

## Component 8 — AI Research Hub

**Technical Role**

A v2.0 RAG-powered qualitative research layer. It stores user-supplied LLM API keys encrypted (AES-256-GCM), ingests financial documents into pgvector with semantic chunking, routes LLM inference across 6 providers (Google, Groq, DeepSeek, OpenAI, Anthropic, OpenRouter), and surfaces structured research cards with a persistent financial disclaimer. This component adds decision-support intelligence without ever recommending specific allocations.

**Belongs To**

- EPIC-09 — AI Research Hub v2.0 (STORY-030, STORY-031, STORY-031b, STORY-032, STORY-032b, STORY-033)

**Key Responsibilities**

- LLM key encrypted storage and settings UI (6 providers, free-tier labels)
- RAG ingest pipeline: semantic chunking, embedding (Google text-embedding-004 or OpenAI text-embedding-3-small), HNSW index
- Default knowledge base (/knowledge directory with curated Markdown documents)
- User document upload to Supabase Storage + corpus management
- Research endpoint: cosine similarity retrieval + LLM inference routing
- Research session caching (24-hour TTL, explicit refresh invalidation)
- Allocation guard: detect and reject any LLM output recommending specific weight percentages
- Research page UI: DisclaimerBanner, ResearchCards (SentimentCard, RiskFactorsCard, NarrativeSummaryCard)
- AiInsightTag on PeerCard (v2.0 only)
- Persistent "This is not financial advice" disclaimer on every AI output surface and every page footer

**Interaction With Other Components**

- Triggered from Asset Discovery (Component 7) via ticker search on Discover page
- Triggered from Portfolio Data Layer (Component 2) when user selects asset from holdings
- Reads from Market Data (Component 5) for current price context during research
- Consumes LLM provider APIs (Google, Groq, DeepSeek, OpenAI, Anthropic, OpenRouter) via AI Gateway
- Embeddings routed through AI Gateway or direct provider endpoints

---

## Component 10 — Portfolio Projection & Optimization Engine

**Technical Role**

The portfolio simulation and mean-variance optimization layer. It runs Markowitz-style optimization (scipy.optimize) on a silo of 2+ assets, fetching up to 5 years of daily price history via yfinance, caching results in Supabase, and returning three strategy allocations (minimum volatility, maximum Sharpe ratio, target risk) with 3-month forward projections. The computational engine runs as a Python FastAPI microservice hosted on Railway, proxied through Next.js so that API keys and external calls never reach the browser. A companion backfill endpoint populates `assets.market_debut_date` from yfinance 5-year history, enabling the 3-month minimum age constraint.

**Belongs To**

- EPIC-11 — Portfolio Projection & Optimization (STORY-040 through STORY-043)

**Key Responsibilities**

- FastAPI microservice on Railway (`api/index.py`) with CORS locked to Next.js origins
- Optimization endpoint (`POST /optimize`) — cache-first price fetch, dynamic truncation, annualized μ/Σ, three scipy.optimize strategies, 3-month projection math, F11-R14 response shape
- Backfill endpoint (`POST /backfill_debut`) — yfinance 5yr history → `assets.market_debut_date` upsert
- Next.js proxy route (`app/api/optimize/route.ts`) forwarding to Railway with `X-API-Key` auth
- `useSimulationConstraints` hook — min 2 assets, min 3 months trading history per asset
- Simulation UI — `SimulateScenariosButton`, `SimulationResultsTable`, `StrategyCard`, `TruncationWarning`, `SimulationDisclaimer`
- Apply Weights wiring — pre-fills target weight inputs in the SiloDetailPage weight editor
- Stale-while-revalidate cache in `asset_historical_data` (Supabase, 24h TTL)

**Interaction With Other Components**

- Consumed by SiloDetailPage — the simulation UI is embedded below the holdings table
- Reads price series from `asset_historical_data` (Supabase, populated by yfinance)
- Reads `market_debut_date` from `assets` table to enforce 3-month minimum age constraint
- Writes back `market_debut_date` to `assets` when a new ticker's price series is first fetched
- Writes optimized `historical_prices` to `asset_historical_data` (global read cache, no RLS)
- Apply Weights feeds into Component 2's target weight editor (local React state only, no API call)

---

## Component 9 — PWA & Cross-Cutting UI

**Technical Role**

Provides the progressive web app shell, offline resilience, and standardised loading/error/empty states across all components. It also handles first-session onboarding and the final performance audit. These are cross-cutting concerns that span every page and component in the application.

**Belongs To**

- EPIC-08 — PWA & Polish (STORY-027, STORY-028, STORY-029)

**Key Responsibilities**

- next-pwa integration with service worker and manifest.json
- OfflineBanner in AppShell (navigator.onLine detection)
- Offline caching of last-known state via service worker
- Onboarding modal (first login only — shown once)
- Progress banner for multi-step flows
- LoadingSkeleton standardisation across all data-fetching components
- ErrorBanner with error code, message, and retry button
- EmptyState standardisation (icon + one-line description + CTA button)
- Performance audit against all NFR targets (page load, calculation speed, news refresh latency)

**Interaction With Other Components**

- Wraps all components via AppShell (Component 1) and shared component library
- OfflineBanner mounted in AppShell (Component 1)
- LoadingSkeleton, ErrorBanner, EmptyState used by every data-fetching component across all components

---

## Component Interaction Map

```
Browser (User)
  │
  ├── AppShell (Component 1 — Auth & Foundation)
  │     ├── Sidebar + TopBar + OfflineBanner
  │     │
  │     ├── OverviewPage
  │     │     ├── Portfolio Data Layer (Component 2)
  │     │     │     └── Market Data (Component 5)
  │     │     │
  │     │     └── SiloCard ×n (Platform Data + Drift)
  │     │
  │     ├── SiloDetailPage
  │     │     ├── Portfolio Data Layer (Component 2)
  │     │     ├── Market Data (Component 5)
  │     │     ├── Portfolio Projection & Optimization Engine (Component 10)
  │     │     │     ├── SimulateScenariosButton → Railway FastAPI /optimize
  │     │     │     └── SimulationResultsTable → Apply Weights → Component 2 weight editor
  │     │     │
  │     │     └── RebalanceButton → RebalancePage
  │     │               └── Rebalancing Engine (Component 3)
  │     │                     ├── Reads: Portfolio Data Layer
  │     │                     ├── Alpaca API (v1.0 execution)
  │     │                     └── Broker Integration (Component 4) ← v2.0 execution
  │     │
  │     ├── NewsPage
  │     │     └── News Feed (Component 6)
  │     │           ├── Finnhub + FMP
  │     │           └── Portfolio Data Layer (ticker list)
  │     │
  │     ├── DiscoverPage
  │     │     ├── Asset Discovery (Component 7)
  │     │     │     ├── Market Data (Component 5)
  │     │     │     └── Portfolio Data Layer (drift summary)
  │     │     └── ResearchPage (ticker trigger)
  │     │               └── AI Research Hub (Component 8)
  │     │                     ├── LLM Providers (6 options)
  │     │                     └── Knowledge Base (pgvector)
  │     │
  │     └── SettingsPage
  │           ├── Portfolio Data Layer (Component 2)
  │           ├── Broker Integration (Component 4)
  │           └── AI Research Hub (Component 8)
  │
  └── PWA & Cross-Cutting UI (Component 9)
        ├── Service Worker
        ├── OfflineBanner
        ├── OnboardingModal
        └── Shared: LoadingSkeleton, ErrorBanner, EmptyState
```

---

## Component to Epic Mapping Summary

| Component                               | Epics                                       | Phase |
| --------------------------------------- | ------------------------------------------- | ----- |
| Component 1 — Auth & Foundation        | EPIC-01                                     | 0     |
| Component 2 — Portfolio Data Layer     | EPIC-02, EPIC-05                            | 1, 4  |
| Component 3 — Rebalancing Engine       | EPIC-03                                     | 2     |
| Component 4 — Broker Integration Layer | EPIC-04, EPIC-10                            | 3, 9  |
| Component 5 — Market Data & Pricing    | EPIC-02, EPIC-04, EPIC-05, EPIC-07 (shared) | 1–7  |
| Component 6 — News Feed                | EPIC-06                                     | 5     |
| Component 7 — Asset Discovery          | EPIC-07, EPIC-05 (partial)                  | 4, 6  |
| Component 8 — AI Research Hub          | EPIC-09                                     | 8     |
| Component 9 — PWA & Cross-Cutting UI   | EPIC-08                                     | 7     |
| Component 10 — Portfolio Projection & Optimization Engine | EPIC-11                                     | 11    |

---

*Last derived from: stories/epics.md, docs/prd/features/F1–F5, F11, docs/architecture/00-system-overview.md, docs/architecture/04-component-tree.md*
