# As-Built Integration Map

> **Purpose:** Documents exactly how the 10 core components and their sub-components currently communicate with each other — not how they *should*, but how they *do*. Read-only codebase analysis as of 2026-04-01.
>
> **Source files:** `docs/components/system_decomposition.md` (high-level map), `docs/architecture/components/*/as_built_prd.md` (component boundaries), and live source code trace.

---

## 1. Component Dependency Matrix

```
Dependency direction: row depends on column.

                  C1  C2  C3  C4  C5  C6  C7  C8  C9  C10
C1 — Auth & Found  —   .   .   .   .   .   .   .   .   .
C2 — Portfolio DL  ✓   —   .   .   ✓   .   .   .   .   .
C3 — Rebal Engine  ✓   ✓   —   .   ✓   .   .   .   .   .
C4 — Broker Intgr  ✓   ✓   ✓   —   ✓   .   .   .   .   .
C5 — Market Data   .   .   .   ✓   —   .   .   .   .   .
C6 — News Feed     .   ✓   .   .   .   —   .   .   .   .
C7 — Asset Disc    .   ✓   .   .   ✓   .   —   .   .   .
C8 — AI Research   .   ✓   ✓   .   ✓   .   ✓   —   .   .
C9 — PWA           ✓   .   .   .   .   .   .   .   —   .
C10 — Portfolio Projection  ✓   .   .   .   .   .   .   .   —

Legend: ✓ = dependency, . = no direct dependency
```

### Detailed Dependency List

| Component | Depends On | Via What | Direction |
|---|---|---|---|
| **C2** Portfolio Data Layer | C1 Auth & Foundation | `lib/supabase/server.ts`, `SessionContext` (silo count, USD toggle) | Consumer |
| **C2** | C5 Market Data | `lib/priceService.ts` (price_cache reads), `lib/fxRates.ts` | Consumer |
| **C2** | C4 Broker Layer | Sync endpoints write `holdings`, `silos.cash_balance`, `price_cache` — C2 is the write target | Write target |
| **C3** Rebalancing Engine | C2 Portfolio Data | API routes `GET /api/silos/:id/holdings`, `GET /api/fx-rates`, `GET /api/silos/:id/drift` — reads holdings, prices, weights | Consumer |
| **C3** | C1 Auth & Foundation | `lib/supabase/server.ts`, `SessionContext` (AlpacaLiveBadge feeds back to SiloCard) | Consumer + write-back |
| **C4** Broker Integration | C1 Auth & Foundation | `user_profiles` table stores encrypted credentials (belongs to C1's schema) | Write target |
| **C4** | C2 Portfolio Data | Sync writes `holdings`, `silos.cash_balance`, `price_cache`; reads from `silos` to get `platform_type` | Write target + read |
| **C4** | C5 Market Data | Calls `fetchPrice()` from `lib/priceService.ts` after every broker sync to populate prices for new holdings | Consumer |
| **C4** | C3 Rebalancing | Extends C3's `POST /api/silos/:id/rebalance/execute` pattern for all non-Alpaca platforms (BITKUB v2.0, InnovestX v2.0, Schwab v2.0, Webull v2.0) | Pattern extension |
| **C5** Market Data & Pricing | C4 Broker Integration | BITKUB sync route writes THB prices into `price_cache` — C5 is the write target | Write target |
| **C6** News Feed | C2 Portfolio Data | Reads ticker list from `holdings JOIN assets` to build portfolio-news filter list | Consumer |
| **C7** Asset Discovery | C2 Portfolio Data | `GET /api/silos/:id/drift` for drift summary; silo list for mini drift on Discover page | Consumer |
| **C7** | C5 Market Data | `lib/priceService.ts` for live prices on peer cards and top movers | Consumer |
| **C7** | C8 AI Research | `/research/[ticker]` triggered from Discover page peer selection (`AiInsightTag` on PeerCard in v2.0) | Navigation trigger |
| **C8** AI Research Hub | C3 Rebalancing | AES-256-GCM encryption pattern (same `lib/encryption.ts` used by C3 for Alpaca keys) | Shared lib |
| **C8** | C2 Portfolio Data | Research triggered from holdings ticker click; reads `news_cache` for news context | Consumer |
| **C8** | C5 Market Data | Current price context via Finnhub calls (within research endpoint) | Consumer |
| **C8** | C9 PWA | `DisclaimerBanner` on Research page; `FooterDisclaimer` in page footer | UI consumer |
| **C9** PWA & Cross-Cutting | C1 Auth & Foundation | `OfflineBanner` mounted in `AppShell`; `OnboardingModal` wired to `SessionContext` | Mounted in C1 |
| **C10** Portfolio Projection | C1 Auth & Foundation | `app/api/optimize/route.ts` uses `lib/supabase/server.ts` (indirect — no direct auth in proxy route) | Consumer |
| **C10** | C2 Portfolio Data | Reads `holdings` from TanStack Query → extracts ticker list → calls proxy route; `applyWeights` writes back to SiloDetailView local state (C2 weight editor) | Consumer + write-back (local) |

---

## 2. Sub-Component Wiring Map

This section documents how sub-components within each component are connected — which components render which, how props flow, and what state managers they use.

---

### C1 — Auth & Foundation: Sub-Component Tree

```
app/layout.tsx
  └── Providers          (QueryClientProvider + SessionProvider)
        └── SessionContext         ← 'use client', wraps entire app
              ├── session | user | profile | showUSD | siloCount
              │     (read by: Sidebar, TopBar, OverviewPage, OnboardingGate,
              │              NewsPage, DiscoverPage, SiloDetailView)
              └── refreshProfile() (calls createClient() → user_profiles + silos)

app/(dashboard)/layout.tsx          ← server component
  └── DirtyStateProvider           (DirtyStateContext — unsaved weight guard)
  └── Sidebar                      ← C1 layout sub-component
  └── TopBar                       ← C1 layout sub-component
        └── reads: SessionContext (showUSD, session)
        └── reads: useQuery('profile')    (notification_count)
        └── reads: useQuery('fx-rates')  (overview page only)
        └── writes: PATCH /api/profile    (show_usd_toggle)
  └── OfflineBanner                ← C9 (shared)
  └── BottomTabBar                  ← C1 layout sub-component
        └── reads: SessionContext (siloCount)
  └── OnboardingGate               ← C9 (shared)
        └── reads: SessionContext (onboarded, siloCount, progressBannerDismissed)

OnboardingGate
  └── OnboardingModal               ← C9
  └── ProgressBanner               ← C9

Sidebar
  └── reads: SessionContext (profile, session)
  └── reads: useQuery('profile')   (siloCount, display_name)
  └── calls: supabase.auth.signOut()

app/(auth)/layout.tsx
  └── (auth pages: login, signup, reset-password — no children rendered here)
```

**C1 Context Providers:**

| Provider | File | Wraps | State exposed |
|---|---|---|---|
| `SessionProvider` | `contexts/SessionContext.tsx` | Entire app (`app/layout.tsx`) | `session`, `user`, `profile`, `showUSD`, `siloCount`, `onboarded`, `progressBannerDismissed`, `refreshProfile`, `isLoading` |
| `DirtyStateProvider` | `contexts/DirtyStateContext.tsx` | Dashboard layout only | `isDirty`, `setIsDirty`, `confirmNavigation` |

**Auth pages** (`app/(auth)/login`, `app/(auth)/signup`, `app/(auth)/reset-password`) each call `createClient()` directly from `@/lib/supabase/client` for `signInWithPassword`, `signUp`, and `auth.resetPasswordForEmail` — these are the only React components that use the Supabase browser client directly (appropriate for auth forms).

---

### C2 — Portfolio Data Layer: Sub-Component Tree

```
OverviewPage                        ← app/(dashboard)/overview/page.tsx
  ├── PortfolioSummaryCard          ← components/overview/PortfolioSummaryCard
  │     └── reads: props (silos, allDriftAssets, showUSD, fxRates)
  │     └── no API calls, pure computation
  │     └── DriftAsset type DEFINED HERE (exported)
  │
  ├── GlobalDriftBanner             ← components/overview/GlobalDriftBanner
  │     └── imports DriftAsset type from ./PortfolioSummaryCard  ← B-1 tangle
  │     └── reads: props (breachedAssets: DriftAsset[])
  │
  ├── SiloCard × n                  ← components/silo/SiloCard
  │     └── imports DriftAsset type from @/components/overview/PortfolioSummaryCard  ← B-1 tangle
  │     └── reads: props (silo: SiloCardData, showUSD, usdRate, driftData: DriftAsset[])
  │     └── reads: SessionContext via props passed from OverviewPage
  │     └── renders: AlpacaLiveBadge (C9 shared)
  │     └── Link → /silos/[id]
  │
  ├── LoadingSkeleton               ← C9 shared
  ├── EmptyState                    ← C9 shared
  └── ErrorBanner                   ← C9 shared

SiloDetailView                      ← components/silo/SiloDetailView  (mounted by silos/[silo_id]/page.tsx)
  ├── SiloHeader                    ← components/silo/SiloHeader
  │     └── props: silo, onAddAsset
  │
  ├── SiloSummaryBar                 ← components/silo/SiloSummaryBar
  │     └── props: totalValue, cashBalance, baseCurrency, siloId, isManual
  │     └── reads: useQuery('holdings', silo.id)
  │     └── renders: SyncButton
  │           └── calls: POST /api/silos/:id/sync  → C4 sync endpoint
  │
  ├── WeightsSumBar                 ← components/silo/WeightsSumBar
  │     └── props: holdings, weightsSumPct
  │
  ├── HoldingsTable                 ← components/silo/HoldingsTable
  │     └── reads: props (holdings, cashBalance, siloId, isManual, baseCurrency, localWeights)
  │     └── reads: useQuery('holdings', silo.id)  (passed down from SiloDetailView)
  │     └── calls: PUT /api/silos/:id/target-weights  (via saveWeights mutation)
  │     └── renders: HoldingRow × n, CashBalanceRow, TargetWeightCell, WeightsSumWarning
  │
  ├── AssetSearchModal              ← components/silo/AssetSearchModal
  │     └── reads: props (siloId, open)
  │     └── calls: POST /api/silos/:id/asset-mappings  (add asset)
  │
  ├── SimulateScenariosButton       ← components/simulation/SimulateScenariosButton  ← grafted (B-4)
  │     └── calls: POST /api/optimize
  │
  └── SimulationResultsTable         ← components/simulation/SimulationResultsTable  ← grafted (B-4)
        └── reads: props (result, holdings, onApplyWeights)
        └── calls: onApplyWeights → writes to SiloDetailView localWeights (in-memory only)

SilosPage                           ← app/(dashboard)/silos/page.tsx
  └── SiloCard × n                  (same component as Overview, different props)

NewSiloPage                         ← app/(dashboard)/silos/new/page.tsx
  └── calls: POST /api/silos         (create silo)
```

**Key prop interfaces (C2 sub-components):**

```typescript
// SiloCardData — defined in SiloCard.tsx
interface SiloCardData {
  id: string; name: string; platform_type: string; base_currency: string;
  drift_threshold: number; total_value: string; last_synced_at: string | null; alpaca_mode?: string;
}

// DriftAsset — defined in PortfolioSummaryCard.tsx  ← B-1
interface DriftAsset {
  asset_id: string; ticker: string; drift_pct: number;
  drift_state: 'green' | 'yellow' | 'red'; drift_breached: boolean;
}

// HoldingsResponse — imported from lib/types/holdings
interface HoldingsResponse {
  holdings: Holding[];
  total_value: string; cash_balance: string; drift_threshold: number;
}
```

---

### C3 — Rebalancing Engine: Sub-Component Tree

```
RebalancePage                       ← app/(dashboard)/silos/[silo_id]/rebalance/page.tsx
  ├── SSR: createServerClient → fetches silo, profile (alpaca_mode), target_weights
  └── RebalanceWizardView          ← components/rebalance/RebalanceWizardView

RebalanceWizardView                 ← components/rebalance/RebalanceWizardView
  ├── RebalanceConfigPanel          ← components/rebalance/RebalanceConfigPanel
  │     └── reads: props (silo, initialWeightsSum)
  │     └── calls: POST /api/silos/:id/rebalance/calculate
  │     └── state: mode, cashInjection (local to view, passed to OrderReviewPanel)
  │
  ├── OrderReviewPanel              ← components/rebalance/OrderReviewPanel
  │     └── reads: props (silo, orders, mode, cashInjection)
  │     └── renders: ConfirmDialog (non-dismissible) ← C9 shared (variant)
  │           └── ConfirmDialog: no onOpenChange handler (Rule 10)
  │           └── calls: POST /api/silos/:id/rebalance/execute
  │
  └── ExecutionResultPanel           ← components/rebalance/ExecutionResultPanel
        └── reads: props (result, orders)

RebalanceHistoryView                 ← components/rebalance/RebalanceHistoryView
  └── reads: useQuery('rebalance/history', silo.id)
        └── GET /api/rebalance/history
```

**Rebalancing wizard step flow (C3 UI):**

```
Step 1: Config  → RebalanceConfigPanel
           calls POST /api/silos/:id/rebalance/calculate
           → creates rebalance_sessions row (status: 'pending')
           → returns orders + snapshot_before

Step 2: Review  → OrderReviewPanel
           reads: orders from Step 1 (passed as prop / stored in view state)
           renders: ConfirmDialog
           user confirms → calls POST /api/silos/:id/rebalance/execute

Step 3: Result  → ExecutionResultPanel
           reads: execution result from Step 2
           displays: Alpaca order IDs, manual instructions
```

**Also used by RebalanceHistoryView:**
`app/(dashboard)/silos/[silo_id]/history/page.tsx` → `RebalanceHistoryView` → reads `GET /api/silos/:id/rebalance/history` and `GET /api/rebalance/history`

---

### C4 — Broker Integration: Sub-Component Tree

Broker integration has no dedicated UI page sub-tree. Broker credentials are managed through the Settings page (C1/C2/C8 settings sections). The sync flow is triggered by:

```
HoldingsTable → SyncButton           (inside SiloSummaryBar, C2)
  └── calls: POST /api/silos/:id/sync
        └── router inside sync route:
              ├── 'alpaca'    → inline (same pattern as C3 Alpaca sync)
              ├── 'bitkub'   → syncBitkub    (lib/bitkub.ts)
              ├── 'innovestx' → syncInnovestx (lib/innovestx.ts)
              ├── 'schwab'   → syncSchwab    (lib/schwab.ts)
              └── 'webull'   → syncWebull    (lib/webull.ts)
```

Broker settings UI is embedded in `app/(dashboard)/settings/page.tsx` via:
- `BrokerSettingsSection` (C4) — BITKUB, InnovestX, Schwab, Webull credential forms
- Each form calls `PATCH /api/profile` (C1) with encrypted credentials

---

### C5 — Market Data & Pricing: Sub-Component Tree

C5 has no UI components — it is purely a server-side service layer. Its sub-components are API routes:

```
GET /api/fx-rates                    ← reads: fx_rates table; writes: ExchangeRate-API fetch + cache
GET /api/market/top-movers          ← reads: price_cache, assets; writes: FMP/Finnhub fetch
lib/priceService.ts                  ← fetchPrice(), called by drift/sync/calculate routes
```

No page-level or component-level sub-tree. All C5 data is consumed by C2, C3, C4, C7 via `lib/priceService.ts`.

---

### C6 — News Feed: Sub-Component Tree

```
NewsPage                            ← app/(dashboard)/news/page.tsx
  ├── reads: useQuery('news/portfolio', session.access_token)
  │     └── GET /api/news/portfolio  (bearer-token auth → direct @supabase/supabase-js client)
  ├── reads: useQuery('news/macro', session.access_token)
  │     └── GET /api/news/macro      (same bearer-token pattern)
  │
  ├── ArticleList                   (inline in page)
  │     └── ArticleCard × n          ← components/news/ArticleCard
  │           └── reads: props (article, isRead, isDismissed)
  │           └── calls: PATCH /api/news/articles/:id/state
  │                 └── GET /api/news/articles/:id/state
  │
  ├── RefreshBar                    (inline)
  │     └── calls: POST /api/news/refresh
  │           └── RateLimitBanner   ← components/news/RateLimitBanner
  │                 └── reads: rate limit state from useQuery
  │
  ├── LoadingSkeleton               ← C9 shared
  ├── EmptyState                    ← C9 shared
  └── ErrorBanner                   ← C9 shared
```

**Bearer-token auth pattern for news routes:**

TanStack Query on `NewsPage` passes `session.access_token` as a `Authorization: Bearer <token>` header. The news API routes (`/api/news/portfolio`, `/api/news/macro`, `/api/news/articles/:id/state`) construct their Supabase client directly with this header (bypassing `lib/supabase/server.ts` cookie auth). This is necessary because TanStack Query `useQuery` fires from a client component with no cookie jar available server-side.

---

### C7 — Asset Discovery: Sub-Component Tree

```
DiscoverPage                        ← app/(dashboard)/discover/page.tsx
  ├── reads: useQuery('silos')           (SessionContext via TanStack Query)
  │     └── GET /api/silos
  │
  ├── reads: useQuery('market/top-movers', type)
  │     └── GET /api/market/top-movers
  │
  ├── TopMoversTabs                 (inline)
  │     └── TopMoversTable          ← components/discover/TopMoversTable
  │           └── AssetSearchBar   (inline)
  │
  ├── reads: useQuery('assets/search', q, type)
  │     └── GET /api/assets/search
  │
  ├── reads: useQuery('assets/:id/peers', assetId)
  │     └── GET /api/assets/:id/peers
  │
  ├── PeerResultsGrid               ← components/discover/PeerResultsGrid
  │     └── PeerCard × n            ← components/discover/PeerCard
  │           └── AiInsightTag      ← components/shared/AiInsightTag  (C8 — v2.0 only)
  │           └── renders: /research/[ticker] link
  │
  ├── PortfolioDriftSummary          ← components/discover/PortfolioDriftSummary
  │     └── reads: useQuery('silos/:id/drift') per silo
  │           └── DriftSiloBlock × n ← components/discover/DriftSiloBlock
  │
  └── reads: useQuery('profile')           (llm_connected)
        └── GET /api/profile
```

**Discover → Research navigation trigger:**
Clicking a ticker on a `PeerCard` navigates to `/research/[ticker]` → `ResearchTickerPage` (C8). This is the primary path from C7 into C8.

The `AiInsightTag` on `PeerCard` reads from the `research_sessions` cache — it does NOT trigger a new LLM call.

---

### C8 — AI Research Hub: Sub-Component Tree

```
ResearchTickerPage                  ← app/(dashboard)/research/[ticker]/page.tsx
  ├── SSR: createServerClient → fetches asset (name), user_profiles (llm_key_enc)
  ├── DisclaimerBanner              ← components/research/DisclaimerBanner
  │     └── static "This is not financial advice" banner
  └── ResearchHubClient             ← components/research/ResearchHubClient

ResearchHubClient                    ← components/research/ResearchHubClient
  ├── reads: props (ticker, companyName, llmConnected)
  ├── LlmKeyGate                     ← components/research/LlmKeyGate
  │     └── shows: API key input form if !llmConnected
  │           └── calls: PATCH /api/profile (encrypt + store LLM key)
  │
  ├── ResearchHeader                 ← components/research/ResearchHeader
  │     └── reads: props (ticker, companyName)
  │
  ├── reads: useQuery('research/ticker', ticker)
  │     └── GET /api/research/:ticker  (cached; forces new fetch on explicit refresh)
  │
  ├── SentimentCard                  ← components/research/SentimentCard
  │     └── reads: research session data (from query cache)
  │
  ├── RiskFactorsCard                ← components/research/RiskFactorsCard
  │     └── reads: research session data
  │
  ├── NarrativeSummaryCard           ← components/research/NarrativeSummaryCard
  │     └── reads: research session data
  │
  └── calls: POST /api/research/:ticker (on user refresh)
        └── LLM router (lib/llmRouter.ts) → 6 providers (Google, Groq, DeepSeek, OpenAI, Anthropic, OpenRouter)
        └── reads: news_cache (for news context)
        └── writes: research_sessions (24h TTL)
```

**LLM settings** are managed in `app/(dashboard)/settings/page.tsx` via `LlmSettingsSection` (C8), which calls `GET/PATCH /api/profile`.

**Knowledge base management** (separate section of Settings or dedicated page):
- `POST /api/knowledge/ingest` — ingest default knowledge base
- `POST /api/knowledge/upload` — user document upload
- `DELETE /api/knowledge/documents/:id` — remove document
- `GET /api/knowledge/corpus-size` — corpus size for capacity warning

---

### C9 — PWA & Cross-Cutting: Sub-Component Tree

C9 sub-components are consumed by ALL other components:

```
AppShell (via app/(dashboard)/layout.tsx)
  ├── Sidebar                        ← C1
  ├── TopBar                         ← C1
  ├── BottomTabBar                    ← C1
  ├── OfflineBanner                  ← components/shared/OfflineBanner
  │     └── reads: navigator.onLine (browser API)
  │     └── effect: NetworkFirst service worker caching on API calls
  │     └── disables: Sync/Refresh/Rebalance buttons when offline
  └── OnboardingGate                 ← mounts:
        ├── OnboardingModal          ← components/shared/OnboardingModal
        │     └── calls: POST /api/silos (creates first silo)
        │     └── non-dismissible (Rule 10 variant)
        │     └── calls: SessionContext.refreshProfile() on success
        └── ProgressBanner           ← components/shared/ProgressBanner
              └── reads: useQuery('silos'), 'holdings', 'rebalance/history'
              └── calls: PATCH /api/profile (dismiss state persisted server-side)

OnboardingModal creates a silo directly → calls SessionContext.refreshProfile() → navigates to new silo.

Shared UI primitives (used by ALL components C1–C8):
  ├── LoadingSkeleton               ← components/shared/LoadingSkeleton
  ├── ErrorBanner                   ← components/shared/ErrorBanner
  ├── EmptyState                    ← components/shared/EmptyState
  ├── ConfirmDialog                 ← components/shared/ConfirmDialog
  │     └── variant="destructive" for Confirm (Rule 20)
  │     └── no onOpenChange handler (Rule 10 — non-dismissible for execution)
  ├── AlpacaLiveBadge               ← components/shared/AlpacaLiveBadge
  │     └── rendered by: SiloCard (C2), SiloHeader (C2)
  ├── DriftBadge                    ← components/shared/DriftBadge
  ├── StalenessTag                  ← components/shared/StalenessTag
  ├── AiInsightTag                  ← components/shared/AiInsightTag
  │     └── consumed by: PeerCard (C7)
  └── DisclaimerBanner              ← components/research/DisclaimerBanner
        └── consumed by: ResearchPage (C8), page footers (all pages)
```

**PWA infrastructure** (`app/layout.tsx` → `next-pwa`):
- `manifest.json` — icons, theme color, standalone display
- Service worker: `NetworkFirst` for API calls, `CacheFirst` for static assets
- `OfflineBanner` shown when `navigator.onLine === false`

---

### C10 — Portfolio Projection & Optimization Engine: Sub-Component Tree

```
SiloDetailView                      ← components/silo/SiloDetailView  (mounted by silos/[silo_id]/page.tsx)
  │
  ├── [existing C2 sub-components: SiloHeader, SiloSummaryBar,
  │      HoldingsTable, AssetSearchModal, WeightsSumBar]
  │
  ├── SimulateScenariosButton       ← components/simulation/SimulateScenariosButton
  │     └── reads: useSimulationConstraints(holdings)  ← hook, no API call
  │     └── calls: POST /api/optimize
  │           ├── if lastSimulatedState === currentTickers → toast (F11-R13 dedup)
  │           └── else → Railway /optimize → Railway /optimize
  │                 └── X-API-Key: RAILWAY_API_KEY (server-side env, never in bundle)
  │
  └── SimulationResultsTable         ← components/simulation/SimulationResultsTable
        └── renders: SimulationDisclaimer → TruncationWarning → StrategyCard × 3
              └── each StrategyCard:
                    └── onApply(weights) → SiloDetailView.setLocalWeights(ticker→asset_id mapped)
                          └── No API call — in-memory only
```

**Railway FastAPI microservice (outside Vercel):**

```
Railway: uvicorn api.index:app
  ├── POST /optimize
  │     ├── verify_api_key (X-API-Key header vs RAILWAY_API_KEY env)
  │     ├── fetch_prices(tickers, supabase)
  │     │     ├── cache hit? asset_historical_data.last_updated < 24h → use cached
  │     │     ├── cache miss → yfinance 5yr → upsert asset_historical_data
  │     │     └── upsert assets.market_debut_date (first price date)
  │     ├── truncate_to_common_length() → limiting_ticker, lookback_months
  │     ├── calculate_annualized_metrics() → μ (252×), Σ (252×)
  │     ├── min_variance_portfolio(mu, Sigma) → not_to_lose weights
  │     ├── max_sharpe_portfolio(mu, Sigma) → expected weights + sigma_sharpe
  │     ├── target_risk_portfolio(mu, Sigma, sigma_sharpe) → optimistic weights
  │     └── project_3m() → return_3m, range (95% CI)
  │
  └── POST /backfill_debut
        ├── verify_api_key (same dependency)
        ├── yfinance 5yr → earliest date
        └── upsert assets.market_debut_date (older date wins)
```

**Next.js proxy route:**

```
POST /api/optimize/route.ts
  ├── reads: { tickers } from request body
  ├── reads: RAILWAY_URL, RAILWAY_API_KEY from process.env (server-only)
  ├── fetch ${RAILWAY_URL}/optimize
  │     ├── method: POST
  │     ├── headers: X-API-Key: RAILWAY_API_KEY, Content-Type: application/json
  │     └── body: JSON.stringify({ tickers })
  └── returns: Railway response verbatim (NextResponse.json)
```

---

## 3. Data Flows & Contracts

### 3.1 Supabase Client Architecture

All Supabase clients flow through one of three paths:

```
Browser Components
  └── lib/supabase/client.ts        → createBrowserClient (React components, auth forms)
       └── @supabase/ssr createBrowserClient

API Routes (server-side)
  ├── lib/supabase/server.ts        → createServerClient (cookie-based auth, most routes)
  │    └── @supabase/ssr createServerClient + next/headers cookies
  │
  └── @supabase/supabase-js directly  → news routes only (bearer-token auth from client)
       ├── app/api/news/portfolio/route.ts
       ├── app/api/news/macro/route.ts
       ├── app/api/news/articles/[article_id]/state/route.ts
       └── app/api/news/refresh/route.ts

Cron Jobs
  └── @supabase/supabase-js directly + service role key (bypasses RLS)
       └── app/api/cron/drift-digest/route.ts
```

**Contract note:** The news routes' direct `@supabase/supabase-js` usage is a workaround for passing Bearer-token auth from TanStack Query client-side calls into server-side routes — cookie-based auth (via `server.ts`) is unavailable in those calling patterns. This is intentional but undocumented architecturally.

---

### 3.2 Cross-Component Data Flows

#### Flow 1: Rebalancing — C2 → C3 → C1 (write-back)

```
OverviewPage
  └── SiloCard ──[RebalanceButton]── SiloDetailPage
                                            │
C3: POST /api/silos/:id/rebalance/calculate
  │   reads: holdings (C2), prices (C5 via priceService), target_weights (C2)
  │   writes: rebalance_sessions (snapshot_before JSONB), rebalance_orders
  │
  └── 3-step Wizard UI
          Config → Review → ConfirmDialog (non-dismissible) → Result

C3: POST /api/silos/:id/rebalance/execute
  │   decrypts Alpaca credentials (lib/encryption.ts)
  │   submits market orders to Alpaca API
  │   writes: rebalance_sessions.status (pending→approved/partial), snapshot_after
  │
  └── AlpacaLiveBadge (C1)
          reads: silo.alpaca_mode = 'live' → rendered in SiloCard (C1)
```

#### Flow 2: Broker Sync — C4 → C2 (write-back)

```
User clicks Sync
  └── POST /api/silos/:id/sync
          dispatches based on platform_type:
          ├── 'alpaca'     → inline Alpaca sync (C3 pattern)
          ├── 'bitkub'    → syncBitkub (lib/bitkub.ts)
          ├── 'innovestx' → syncInnovestx (lib/innovestx.ts) [Settrade OAuth + Digital HMAC, sequential]
          ├── 'schwab'    → syncSchwab (lib/schwab.ts) [OAuth refresh]
          └── 'webull'    → syncWebull (lib/webull.ts)

  For each broker:
    1. decrypt credentials (lib/encryption.ts)
    2. call broker API → parse positions
    3. upsert holdings (C2 schema)
    4. update silos.cash_balance, silos.last_synced_at
    5. call fetchPrice() from lib/priceService.ts → populate price_cache (C5)
```

#### Flow 3: News Feed — C2 (read) + C6 (display)

```
NewsPage (C6 UI consuming C2's ticker list)
  │
  └── GET /api/news/portfolio
          │   reads: holdings JOIN assets → ticker list (C2 data)
          │   two-tier filter:
          │     Tier 1: GIN index on tickers[] (exact match)
          │     Tier 2: metadata.related_tickers[] overlap
          └── paginated from news_cache

  └── GET /api/news/macro
          reads: news_cache WHERE is_macro = TRUE

  └── POST /api/news/refresh (user-initiated)
          │   fetches: Finnhub + FMP (via lib/newsService.ts)
          │   rate-limit guard: globalThis Map (15-min window)
          │   upserts: news_cache (service-role client)
          └── user_article_state: read/dismiss per user (RLS-enforced)

  pg_cron: daily 02:00 UTC purge of news_cache rows older than 24h
```

#### Flow 4: Asset Discovery → AI Research — C7 → C8

```
DiscoverPage (C7)
  │
  ├── GET /api/assets/search?q=&type=     → Finnhub (stocks) or CoinGecko (crypto)
  ├── GET /api/assets/:id/peers            → Finnhub /stock/peers; fallback sector_taxonomy.json (static)
  ├── GET /api/market/top-movers?type=    → FMP primary, Finnhub fallback, stale cache final (C5)
  │
  └── User clicks a ticker on PeerCard
          └── /research/[ticker]           → C8 AI Research Hub

Research/[ticker] (C8)
  │
  ├── GET /api/profile                     → returns llm_connected, llm_provider, llm_model (NO ciphertext)
  ├── PATCH /api/profile                   → encrypt + store LLM key (lib/encryption.ts, AES-256-GCM)
  │
  ├── POST /api/research/:ticker (new research)
  │       1. decrypt user's LLM key (lib/encryption.ts)
  │       2. cosine similarity retrieval via RPC match_knowledge_chunks (pgvector HNSW)
  │       3. embed query via user's provider (Google text-embedding-004 or OpenAI text-embedding-3-small)
  │       4. call LLM via lib/llmRouter.ts (6 providers: Google, Groq, DeepSeek, OpenAI, Anthropic, OpenRouter)
  │       5. allocation guard: regex scan → HTTP 422 if weight % detected
  │       6. upsert research_sessions (24h TTL)
  │       7. disclaimer: "This is not financial advice" on every output surface
  │
  └── AiInsightTag on PeerCard (C7)        → reads cached research, never triggers new LLM call
```

#### Flow 5: Drift Digest Cron — C2 + C3 + Email

```
pg_cron: daily 08:00 UTC
  └── POST /api/cron/drift-digest
          service-role client (bypasses RLS)
          1. query all silos with holdings + target_weights + price_cache
          2. compute drift inline (NOT using lib/drift.ts — duplicated logic)
          3. build HTML email via lib/driftDigest.ts
          4. send via Resend email API
          5. check Schwab token expiry → notify user if < 7 days remaining
```

#### Flow 6: Portfolio Projection — C10 ↔ Railway ↔ Supabase

```
User clicks "Simulate Scenarios"
  │
  └── SimulateScenariosButton
        ├── useSimulationConstraints(holdings) → isDisabled check (no API call)
        ├── F11-R13 dedup: currentTickers === lastSimulatedState?
        │     └── If same → toast("Asset composition hasn't changed...") → skip
        └── POST /api/optimize/route.ts
              ├── { tickers: string[] }  (extracted from SiloDetailView holdings)
              ├── RAILWAY_URL + RAILWAY_API_KEY from process.env (server-only)
              └── fetch ${RAILWAY_URL}/optimize
                    ├── X-API-Key: RAILWAY_API_KEY (never in browser bundle)
                    └── body: { tickers }

Railway FastAPI — POST /optimize
  │
  ├── verify_api_key → 401 if X-API-Key missing/wrong
  │
  ├── fetch_prices(tickers)
  │     ├── asset_historical_data.last_updated < 24h?
  │     │     └── YES → return cached historical_prices
  │     │     └── NO  → yfinance 5yr → upsert asset_historical_data
  │     │                   → upsert assets.market_debut_date (first price date)
  │     └── return { ticker: [{ date, close }] }
  │
  ├── truncate_to_common_length()
  │     └── identifies limiting_ticker, computes lookback_months
  │
  ├── calculate_annualized_metrics()
  │     └── daily returns → μ×252, Σ×252
  │
  ├── min_variance_portfolio(mu, Σ)   → not_to_lose weights
  ├── max_sharpe_portfolio(mu, Σ)      → expected weights + sigma_sharpe
  └── target_risk_portfolio(mu, Σ)     → optimistic weights (vol ≤ 1.5×σ_sharpe)
  │
  └── return { strategies: { not_to_lose, expected, optimistic }, metadata }

Railway FastAPI — POST /backfill_debut
  │
  ├── verify_api_key → 401 if missing/wrong
  ├── yfinance 5yr → earliest date
  └── upsert assets.market_debut_date (older date wins)
  └── return { ticker, market_debut_date }

SimulationResultsTable renders
  │
  ├── SimulationDisclaimer (always visible)
  ├── TruncationWarning (if lookback_months < 36)
  └── StrategyCard × 3 (not_to_lose / expected / optimistic)

User clicks "Apply Weights" on a StrategyCard
  │
  └── onApplyWeights({ AAPL: 0.4, TSLA: 0.6 })
        ├── SiloDetailView maps ticker keys → asset_id keys
        └── sets localWeights state (in-memory only — no API call)
              └── User must manually save via PUT /api/silos/:id/target-weights
```

---

### 3.3 Shared Library Contracts (Cross-Component Libs)

| Lib | Signature | Used By | Tables touched |
|---|---|---|---|
| `lib/supabase/server.ts` | `createClient()` | All major API routes | Any (generic client) |
| `lib/supabase/client.ts` | `createClient()` | React components (auth forms, SessionContext) | Any (browser) |
| `lib/priceService.ts` | `fetchPrice(assetId, symbol, type): Promise<number>` | `silos/[id]/drift`, `silos/[id]/sync`, `silos/[id]/rebalance/calculate`, `silos/[id]/asset-mappings`, `silos/[id]/rebalance/calculate` | `price_cache`, `price_cache_fresh` |
| `lib/encryption.ts` | `encrypt(plaintext, key): string`, `decrypt(ciphertext, key): string` | `profile/route.ts`, `silos/[id]/sync/route.ts`, `rebalance/execute/route.ts`, `auth/schwab/callback/route.ts`, `research/[ticker]/route.ts` | `user_profiles` |
| `lib/silos.ts` | `checkSiloLimit(supabase, userId): boolean`, `buildSiloResponse(silo): SiloCardData` | `silos/route.ts`, `silos/[id]/route.ts` | `silos`, `user_profiles` |
| `lib/drift.ts` | `computeDriftState(driftPct, threshold): 'green' \| 'yellow' \| 'red'` | `silos/[id]/drift/route.ts` | None (pure computation) |
| `lib/fxRates.ts` | `parseExchangeRates(json): FxRate[]`, `rateToUsd(rates, currency): number` | `fx-rates/route.ts` | `fx_rates` |
| `lib/rebalanceEngine.ts` | `calculateRebalance(holdings, prices, weights, mode, cashInjection?): RebalanceResult` | `silos/[id]/rebalance/calculate/route.ts` | None (pure computation) |
| `lib/newsService.ts` | `fetchFinnhubNews(tickers): Promise<NewsArticle[]>`, `fetchFmpNews(): Promise<NewsArticle[]>` | `news/refresh/route.ts` | None (pure fetch) |
| `lib/newsQueryService.ts` | `splitIntoTiers(articles): [tier1, tier2]`, `mergeAndRankArticles(tier1, tier2): Article[]`, `paginateArticles(articles, page): Page` | `news/portfolio/route.ts`, `news/macro/route.ts` | `news_cache`, `user_article_state` |
| `lib/ragIngest.ts` | `chunkDocument(content): Chunk[]`, `embedText(text, provider, key): Promise<number[]>`, `embedTexts(texts): Promise<number[][]>` | `knowledge/ingest/route.ts`, `knowledge/upload/route.ts` | `knowledge_chunks` |
| `lib/llmRouter.ts` | `callLLM(provider, model, messages, apiKey): Promise<LLMResponse>` | `research/[ticker]/route.ts` | None (pure LLM call) |
| `lib/bitkub.ts` | `buildBitkubSignature(body, key): string`, `parseBitkubTicker(json): TickerPrice[]`, `parseBitkubWallet(json): WalletBalance[]` | `silos/[id]/sync/route.ts` | None |
| `lib/innovestx.ts` | `buildSettradeBasicAuth(token): string`, `parseSettradePortfolio(json): Position[]`, `buildInnovestxDigitalSignature(body, key): string`, `parseInnovestxDigitalBalances(json): DigitalBalance[]` | `silos/[id]/sync/route.ts` | None |
| `lib/schwab.ts` | `buildSchwabAuthUrl(state): string`, `parseSchwabPositions(json): Position[]` | `silos/[id]/sync/route.ts`, `auth/schwab/route.ts`, `auth/schwab/callback/route.ts` | None |
| `lib/webull.ts` | `buildWebullSignature(method, path, ts, params, key): string`, `parseWebullPositions(json): Position[]` | `silos/[id]/sync/route.ts` | None |
| `lib/driftDigest.ts` | `buildDriftDigestHtml(silos, drifts): string`, `escapeHtml(str): string` | `cron/drift-digest/route.ts` | None |
| `lib/profile.ts` | `buildProfileResponse(profile): UserProfileResponse` | `profile/route.ts` | `user_profiles` |
| `lib/types/simulation.ts` | `SimulationResult`, `SimulationStrategy`, `SimulationMetadata` interfaces | `components/simulation/*`, `hooks/useSimulationConstraints.ts`, `app/api/optimize/route.ts` | None (types only) |
| `hooks/useSimulationConstraints.ts` | `useSimulationConstraints(holdings): SimulationConstraints` | `SimulateScenariosButton` | None (pure compute) |

---

## 4. Known Bottlenecks & Tangles

### B-1. `DriftAsset` type lives in the wrong directory

**What:** `components/silo/SiloCard.tsx` imports `DriftAsset` from `components/overview/PortfolioSummaryCard.tsx`.

**Why it's a tangle:** A silo-level component depends on a type defined inside the overview component directory. If `PortfolioSummaryCard` is refactored or moved, `SiloCard` breaks silently.

**Correct location:** `lib/types/` or `components/shared/types.ts`.

**Also affects:** `GlobalDriftBanner` imports `DriftAsset` from `./PortfolioSummaryCard` (same-directory sibling — less problematic but still coupled to that specific file).

---

### B-2. Drift logic is duplicated in `cron/drift-digest`

**What:** `lib/drift.ts` exports `computeDriftState` (used by the live `GET /api/silos/:id/drift` route), but `app/api/cron/drift-digest/route.ts` re-implements the same green/yellow/red classification inline (lines 225–240).

**Risk:** Any change to the drift threshold logic (e.g., adding a fourth state) must be applied in two places or the cron digest will diverge from the live API.

---

### B-3. `lib/encryption.ts` is a single-point-of-failure hub

**What:** One file (`lib/encryption.ts`) is imported by five distinct routes across three components:
- `app/api/profile/route.ts` (C1)
- `app/api/silos/:id/sync/route.ts` (C4 — Alpaca, BITKUB, InnovestX, Schwab, Webull credentials)
- `app/api/silos/:id/rebalance/execute/route.ts` (C3 — Alpaca execution)
- `app/api/auth/schwab/callback/route.ts` (C4 — Schwab OAuth tokens)
- `app/api/research/:ticker/route.ts` (C8 — LLM API keys)

**Risk:** Changing the encryption algorithm, key environment variable name, or IV/nonce handling breaks all five simultaneously with no compile-time guard.

---

### B-4. Simulation feature grafted onto SiloDetailView via direct component import

**What:** `components/silo/SiloDetailView.tsx` imports directly:
```typescript
import { SimulateScenariosButton } from '@/components/simulation/SimulateScenariosButton'
import { SimulationResultsTable } from '@/components/simulation/SimulationResultsTable'
```

**Why it's a tangle:** The simulation feature is not behind a clean route boundary — it is rendered inline inside the Silo detail view. There is no `app/(dashboard)/simulation/` route tree; the component is embedded directly. `SimulationResultsTable.onApplyWeights` writes back to `SiloDetailView`'s local state (localWeights), which is an inverted dependency: the child mutates parent state via callback prop.

---

### B-5. `market/top-movers` has no shared lib

**What:** The `GET /api/market/top-movers` route implements FMP and Finnhub API calls, price formatting, and fallback logic entirely inline. Unlike price fetching (which is abstracted into `lib/priceService.ts`), top-movers logic is not reusable.

**Risk:** If another route needs top-mover data, the logic must be duplicated.

---

### B-6. News routes use `@supabase/supabase-js` directly instead of `server.ts`

**What:** Four routes (`news/portfolio`, `news/macro`, `news/articles/[id]/state`, `news/refresh`) bypass `lib/supabase/server.ts` and construct the Supabase client directly:
```typescript
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, anonKey, { global: { headers: { Authorization: bearerToken } } })
```

All other API routes use `lib/supabase/server.ts`.

**Why it exists:** TanStack Query calls from client components can't use cookie-based auth (server.ts's mechanism), so the news routes accept Bearer token headers directly.

**Risk:** These routes are RLS-blind at the client-construction level — the `Authorization` header must be validated server-side. Any route handler that forgets to validate the header silently operates without user identity.

---

### B-7. `lib/priceHistory.ts` is orphaned

**What:** `fetchPriceHistory(assetId)` uses `yahoo-finance2` to fetch 5-year daily OHLCV data and writes to `asset_historical_data` table. The function exists in `lib/` but is not imported by any route.

**Status:** Likely a pending feature or dead code. No other file references it.

---

### B-8. SessionContext drives display state that other components shouldn't need to share

**What:** `SessionContext` exposes not just auth state (`session`, `user`, `profile`) but also UI state (`showUSD`, `siloCount`, `onboarded`, `progressBannerDismissed`). The `siloCount` in particular is a cache of a server value (`SELECT COUNT(*) FROM silos WHERE user_id = ...`) that could go stale.

**Why it's a tangle:** Any component that reads `siloCount` from context is trusting it as eventually consistent with the server — but there's no invalidation signal when a silo is created or deleted outside the current tab.

**Components reading `siloCount`:** `Sidebar.tsx`, `OnboardingGate.tsx`, `OnboardingModal.tsx`.

**Components reading `showUSD`:** `TopBar.tsx`, `OverviewPage.tsx`, `SiloCard.tsx` (via props from OverviewPage).

---

## Appendix: State Access Patterns Summary

| State | How accessed | Who accesses |
|---|---|---|
| Auth session | `SessionContext` → `lib/supabase/client.ts` | All dashboard pages, C1/C9 components |
| Silo CRUD | TanStack Query → `GET/POST/DELETE /api/silos` | Overview, Silo list, OnboardingModal |
| Holdings | TanStack Query → `GET/POST/PUT /api/holdings` | SiloDetailView, Rebalance wizard |
| Target weights | TanStack Query → `PUT /api/silos/:id/target-weights` | SiloDetailView |
| Drift data | TanStack Query → `GET /api/drifts`, `GET /api/silos/:id/drift` | SiloCard, GlobalDriftBanner, DiscoverPage |
| Price cache | `lib/priceService.ts` (server-side only) | Drift route, sync route, calculate route, asset-mappings |
| FX rates | `lib/fxRates.ts` → `fx_rates` table (server-side) | `GET /api/fx-rates` route |
| Broker credentials | `lib/encryption.ts` → `user_profiles` columns | Profile route, sync route, execute route |
| Alpaca mode (live badge) | `silo.alpaca_mode` in DB → passed as prop to `AlpacaLiveBadge` | SiloCard (C1) |
| News articles | TanStack Query → `GET /api/news/portfolio`, `GET /api/news/macro` | NewsPage |
| News article state (read/dismiss) | TanStack Query → `PATCH /api/news/articles/:id/state` | NewsPage article interactions |
| LLM research | TanStack Query → `POST /api/research/:ticker` | ResearchPage |
| LLM settings | TanStack Query → `GET/PATCH /api/profile` | SettingsPage, ResearchPage |
| Knowledge corpus | `lib/ragIngest.ts` → `knowledge_chunks` | Knowledge ingest/upload routes |
| Onboarding state | `profile.onboarded` → `SessionContext` | `OnboardingGate`, `OnboardingModal`, `ProgressBanner` |
| Progress banner | `profile.progress_banner_dismissed` → `SessionContext` | `ProgressBanner` |
| Dirty state (unsaved weights) | `DirtyStateContext` | Sidebar (amber indicator), `useDirtyGuard` hook in SiloDetailView |
| Simulation results | Local React state in `SiloDetailView` | `SimulationResultsTable` (via `onApplyWeights` callback) |
| Simulation constraints | `useSimulationConstraints` hook (pure compute, no state) | `SimulateScenariosButton` |
| Railway API key | `process.env.RAILWAY_API_KEY` (Next.js server-only) | `app/api/optimize/route.ts` |

---

*Last verified against source: 2026-04-01. Code trace covered all routes and components from prior trace plus `api/index.py`, `api/optimize.py`, `api/backfill_debut.py`, `api/test_optimize.py`, `railway.json`, `app/api/optimize/route.ts`, `components/simulation/SimulateScenariosButton.tsx`, `components/simulation/SimulationResultsTable.tsx`, `components/simulation/SimulationDisclaimer.tsx`, `components/simulation/TruncationWarning.tsx`, `components/simulation/StrategyCard.tsx`, `hooks/useSimulationConstraints.ts`, `hooks/useSimulationConstraints.test.ts`, `lib/types/simulation.ts`.*
