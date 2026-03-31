# docs/architecture/04-component-tree.md — Frontend Component Tree

## AGENT CONTEXT

**What this file is:** The canonical component hierarchy for all pages and the shared component library. Component names here are authoritative — all stories and API contracts reference these names.
**Derived from:** TECH_DOCS_v1.2.md (DOC-03 Component Tree)
**Connected to:** docs/architecture/03-api-contract.md (components consume these endpoints), docs/design/02-component-library.md (component implementations), docs/design/CLAUDE_FRONTEND.md
**Critical rules for agents using this file:**
- Component names here are canonical. If a story or API contract uses a different name, fix the story/contract.
- Every component that fetches data must have a LoadingSkeleton, an EmptyState, and an ErrorBanner.
- All state management rules at the bottom of this file are absolute.

---

## Routing Structure (Next.js App Router)

```
app/
├── layout.tsx                         ← Root layout — mounts <Toaster position="bottom-right" richColors closeButton /> from Sonner. All dashboard and auth pages inherit this.
├── (auth)/
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   └── reset-password/page.tsx
├── (dashboard)/
│   ├── layout.tsx                     ← AppShell (authenticated shell)
│   ├── overview/page.tsx
│   ├── silos/
│   │   ├── page.tsx
│   │   ├── new/page.tsx
│   │   └── [silo_id]/
│   │       ├── page.tsx               ← SiloDetailPage
│   │       ├── rebalance/page.tsx     ← RebalancePage (3-step wizard)
│   │       └── history/page.tsx       ← RebalanceHistoryPage
│   ├── news/page.tsx
│   ├── discover/page.tsx
│   ├── research/[ticker]/page.tsx     ← v2.0
│   └── settings/page.tsx
├── api/                               ← Next.js API routes (all external calls here)
└── middleware.ts                      ← JWT validation — redirects unauthenticated users to /login
```

---

## 2.1 AppShell

Wraps all `(dashboard)` routes. Always rendered for authenticated users.

```
AppShell
├── Sidebar
│   ├── Logo (wordmark + R mark)
│   ├── NavItems
│   │   ├── NavItem (Overview)
│   │   ├── NavItem (Silos) + SiloCountBadge [X/5]
│   │   ├── NavItem (News)
│   │   ├── NavItem (Discover)
│   │   └── NavItem (Settings)
│   └── UserMenu (avatar, display_name, email, sign-out link)
├── TopBar
│   ├── PageTitle
│   ├── ContextualActions (page-specific: USDToggle, RefreshButton, etc.)
│   └── NotificationBell (drift alert count badge)
├── OfflineBanner (shown when navigator.onLine = false)
└── <children />   ← page content
```

**API consumed:** `GET /api/profile` (for silo count, USD toggle state, notification count)

---

## 2.2 Overview Page

**Route:** `/overview`
**API:** `GET /api/silos`, `GET /api/fx-rates`

```
OverviewPage
├── PortfolioSummaryCard (total value across all silos, active silo count X/5, total unique assets)
├── GlobalDriftBanner (conditional — rendered only if any silo has a drift-breached asset)
│   └── DriftBadge (red) per breached asset
├── SiloCardList
│   └── SiloCard ×n (link to /silos/[silo_id])
│       ├── SiloHeader (name, PlatformBadge, ExecutionModeTag)
│       ├── TotalValueDisplay (in base currency; in USD if toggle on)
│       ├── DriftStatusSummary (X assets breached / all within threshold)
│       └── AlpacaLiveBadge (conditional — shown only when alpaca_mode = 'live')
├── TopMoversWidget (preview — links to /discover)
├── EmptyState (shown when user has zero silos)
└── LoadingSkeleton (shown during initial fetch)
```

---

## 2.3 Silos List Page

**Route:** `/silos`
**API:** `GET /api/silos`

```
SilosPage
├── PageHeader (title + CreateSiloButton — disabled if active_silo_count >= 5)
│   └── SiloUsageInline [3/5 silos used]
├── SiloCardGrid (same SiloCard as Overview)
└── EmptyState (shown when user has zero silos — prominent CTA to create first silo)
```

---

## 2.4 Silo Detail Page

**Route:** `/silos/[silo_id]`
**API:** `GET /api/silos/:id/holdings`, `GET /api/silos/:id/target-weights`, `GET /api/silos/:id/drift`

```
SiloDetailPage
├── SiloHeader
│   ├── SiloName
│   ├── PlatformBadge (API / MANUAL)
│   ├── ExecutionModeTag (AUTO / MANUAL)
│   ├── BaseCurrencyLabel
│   ├── SyncButton (visible only for API silos — triggers POST /sync)
│   ├── LastSyncedTimestamp
│   └── AlpacaLiveBadge (conditional)
├── SiloSummaryBar
│   ├── TotalValueDisplay
│   ├── CashBalanceDisplay
│   └── WeightsSumBar (progress bar showing weight allocation; amber if sum ≠ 100%)
│       └── WeightsSumWarning (conditional — "Weights sum to X%. Remaining Y% held as cash.")
├── HoldingsTable
│   ├── TableHeader
│   └── HoldingRow ×n
│       ├── TickerCell (ticker + name)
│       ├── QuantityCell (editable inline for manual silos)
│       ├── CurrentValueCell (price × quantity, formatted)
│       ├── CurrentWeightCell (derived, read-only)
│       ├── TargetWeightCell (editable inline)
│       ├── DriftCell (DriftBadge — green/yellow/red)
│       └── StalenessTag (conditional — "> X days old" for manual holdings > 7 days)
├── SimulationSection (v2.0 — EPIC-11)
│   ├── SimulateScenariosButton (disabled if < 2 assets or any asset < 3 months old)
│   ├── SimulationResultsTable (shown after successful simulation)
│   │   ├── SimulationDisclaimer (non-collapsible, always visible during simulation)
│   │   ├── TruncationWarning (conditional — shown if lookback < 36 months)
│   │   └── StrategyCard × 3 (Not to Lose / Expected / Optimistic)
│   └── ApplyWeightsButton × 3 (per strategy — pre-fills TargetWeightCell)
├── CashBalanceRow (editable for manual silos; shows cash_target_pct)
├── AddAssetButton → AssetSearchModal
├── RebalanceButton → /silos/[silo_id]/rebalance
├── EmptyState (shown when silo has zero holdings)
└── LoadingSkeleton (during fetch)
```

---

## 2.5 AssetSearchModal

Opened by AddAssetButton in SiloDetailPage.

```
AssetSearchModal
├── TypeSelector (Stock/ETF | Crypto — radio buttons)
├── SearchInput (debounced 300ms → GET /api/assets/search)
├── SearchResultsList
│   └── SearchResultRow ×n
│       ├── TickerDisplay
│       ├── NameDisplay
│       ├── PriceDisplay
│       └── ConfirmButton → POST /api/silos/:id/asset-mappings
├── LoadingState (skeleton while searching)
└── EmptyState (no results found)
```

---

## 2.6 Rebalance Page (3-step wizard)

**Route:** `/silos/[silo_id]/rebalance`
**API:** `POST /api/silos/:id/rebalance/calculate`, `POST /api/silos/:id/rebalance/execute`

```
RebalancePage
├── StepIndicator [① Config → ② Review → ③ Result]
│
├── Step 1: RebalanceConfigPanel
│   ├── PriceAgeNotice — shows "Prices last updated X minutes ago" using the oldest `price_cache.fetched_at` across all holdings in the silo. Shown in amber if any price is older than 10 minutes. Shown with a "Refresh prices" link that triggers `POST /api/silos/:id/sync` for API silos or a manual price refresh for manual silos.
│   ├── ModeSelector (partial | full — rendered as radio cards, NOT a dropdown)
│   ├── FullRebalanceWarning (conditional — shown when mode = 'full')
│   ├── CashToggle (Include cash in rebalancing)
│   ├── CashAmountInput (shown only when CashToggle is on)
│   ├── WeightsSumWarning (conditional)
│   └── CalculateButton → POST /rebalance/calculate → advance to Step 2
│
├── Step 2: OrderReviewPanel
│   ├── SessionSummaryBar (total buys, total sells, net cash change)
│   ├── ExecutionModeNotice (shown for non-Alpaca silos — non-dismissible banner)
│   ├── BalanceErrorBanner (shown if balance_valid = false — halts at Step 1)
│   ├── OrdersTable
│   │   └── OrderRow ×n
│   │       ├── TickerCell
│   │       ├── OrderTypeBadge (BUY green / SELL red)
│   │       ├── QuantityCell
│   │       ├── EstimatedValueCell
│   │       ├── WeightArrow (before_pct → after_pct)
│   │       └── SkipCheckbox
│   ├── CancelButton (ghost, left-aligned — returns to Step 1)
│   └── ExecuteButton (primary, right-aligned) → ConfirmDialog → POST /rebalance/execute
│       └── ConfirmDialog (non-dismissible)
│           ├── OrderCount
│           ├── PlatformName
│           ├── TotalEstimatedValue
│           ├── CancelButton (ghost)
│           └── ConfirmExecuteButton (primary for Alpaca / secondary for manual)
│
└── Step 3: ExecutionResultPanel
    ├── AlpacaResultSection (if platform = 'alpaca')
    │   └── OrderStatusList (executed | skipped | failed per order)
    ├── ManualOrderInstructions (if platform ≠ 'alpaca' or any manual orders)
    │   ├── CopyAllButton — copies all manual instructions as plain text to clipboard; fires `toast.success('Instructions copied')`
    │   └── ManualOrderRow ×n
    │       ├── Instruction text ("Buy X shares of AAPL on [Platform Name].")
    │       └── CopyRowButton — icon-only Copy button; copies this single row; fires `toast.success('Copied')`
    └── BackToSiloButton
```

---

## 2.7 News Page

**Route:** `/news`
**API:** `GET /api/news/portfolio`, `GET /api/news/macro`, `POST /api/news/refresh`, `PATCH /api/news/articles/:id/state`

```
NewsPage
├── NewsTabs (Portfolio News | Macro News)
├── RefreshBar (last updated [relative time] + RefreshButton)
├── RateLimitBanner (conditional — amber, collapsible)
├── ArticleList
│   └── ArticleCard ×n
│       ├── HeadlineText
│       ├── TickerTags (small chips per ticker in article.tickers)
│       ├── SourceAndTimestamp
│       ├── ExternalLink (to original article URL)
│       └── ReadDismissControls (appears on hover — mark as read / dismiss)
├── PaginationControls
└── EmptyState (no articles matching portfolio)
```

---

## 2.8 Discover Page

**Route:** `/discover`
**API:** `GET /api/market/top-movers`, `GET /api/assets/:id/peers`, `GET /api/silos/:id/drift`

```
DiscoverPage
├── TopMoversTabs (US Stocks | Crypto)
│   └── TopMoversTable
│       ├── GainersList (top 5 — ticker, name, price, daily % change in green)
│       └── LosersList (top 5 — ticker, name, price, daily % change in red)
├── AssetPeerSearch
│   ├── SearchInput (search for any ticker to see peers)
│   └── PeerResultsGrid
│       └── PeerCard ×n
│           ├── TickerDisplay
│           ├── NameDisplay
│           ├── PriceDisplay
│           └── AiInsightTag (v2.0 only — 12 words max)
└── PortfolioDriftSummary
    └── DriftSiloBlock ×n (one per silo)
        ├── SiloNameHeader
        └── DriftMiniRow ×n (ticker + DriftBadge)
```

---

## 2.9 Settings Page

**Route:** `/settings`
**API:** `GET /api/profile`, `PATCH /api/profile`

```
SettingsPage
├── ProfileSection (display name input + save)
├── NotificationsSection (drift_notif_channel selector: app | email | both)
├── SiloUsageBar [X / 5 silos used — visual progress bar]
│
├── BrokerSection ("Connected Platforms")
│   ├── AlpacaSection
│   │   ├── ConnectionStatusDot (green = connected)
│   │   ├── AlpacaModeSelector (paper | live — radio)
│   │   ├── ApiKeyInput (type="password", masked after save)
│   │   ├── ApiSecretInput (type="password", masked after save)
│   │   └── SaveButton
│   ├── BitkubSection (key + secret inputs)
│   ├── InnovestXSection (key + secret inputs)
│   ├── SchwabSection
│   │   ├── ConnectionStatusDot
│   │   ├── TokenExpiryWarning (conditional — amber if schwab_token_expired)
│   │   ├── ConnectButton (OAuth redirect to Schwab)
│   │   └── DisconnectButton
│   └── WebullSection (key + secret inputs + "$500 minimum account value required" note)
│
├── LLMSection (v2.0 — "AI Research Key")
│   ├── FreeTierNote ("Gemini 2.0 Flash, Llama 3.3 70B, and DeepSeek V3 are free.")
│   ├── ProviderSelector (dropdown with free-tier labels)
│   ├── ModelSelector (filtered by selected provider)
│   ├── LLMKeyInput (type="password", masked after save)
│   └── SaveButton
│
└── DangerZone
    ├── DividerWithLabel ("Danger Zone")
    └── DeleteAccountButton → ConfirmDialog (destructive)
```

---

## 2.10 Research Page (v2.0)

**Route:** `/research/[ticker]`
**API:** `POST /api/research/:ticker`

```
ResearchPage
├── DisclaimerBanner (always visible, non-collapsible)
├── LLMKeyGate (shown if llm_connected = false — "Add your LLM key in Settings")
├── ResearchHeader (ticker, company name, last refreshed)
├── RefreshButton (triggers new LLM call)
└── ResearchCards
    ├── SentimentCard (bullish/neutral/bearish badge + confidence bar)
    ├── RiskFactorsCard (bulleted list)
    └── NarrativeSummaryCard (150-300 words, expandable)
```

---

## Shared Components

| Component | Used By | Description |
|---|---|---|
| `PriceDisplay` | HoldingRow, PeerCard, TopMoversTable | Formats NUMERIC(20,8) with currency symbol via `formatNumber()` |
| `WeightBadge` | HoldingRow, TargetWeightCell | Coloured pill showing weight % |
| `DriftBadge` | DriftCell, DriftMiniRow | Green/yellow/red with icon + drift_pct |
| `ConfirmDialog` | ExecuteButton, DeleteAccountButton | Non-dismissible (no onOpenChange) |
| `StalenessTag` | HoldingRow | "X days old" for manual holdings > 7 days |
| `PlatformBadge` | SiloCard, SiloHeader | Coloured badge per platform_type |
| `ExecutionModeTag` | SiloCard, SiloHeader | AUTO (Alpaca) or MANUAL (all others in v1.0) |
| `EmptyState` | All list/table components | Icon + one-line description + one CTA button |
| `ErrorBanner` | All API-dependent components | Error code + message + retry button |
| `OfflineBanner` | AppShell | Shown when navigator.onLine = false |
| `LoadingSkeleton` | All data-fetching components | Skeleton placeholders during load |
| `AlpacaLiveBadge` | SiloCard, SiloHeader, RebalancePage | Persistent amber LIVE badge when Alpaca in live mode |
| `AiInsightTag` | PeerCard | v2.0 only — 12-word LLM relationship insight |
| `SimulateScenariosButton` | SiloDetailPage | v2.0 — triggers portfolio simulation; disabled if < 2 assets or any asset < 3 months old |
| `SimulationResultsTable` | SiloDetailPage | v2.0 — renders 3 strategy cards after successful simulation |
| `SimulationDisclaimer` | SiloDetailPage | v2.0 — non-collapsible disclaimer above results |
| `TruncationWarning` | SiloDetailPage | v2.0 — amber warning when lookback < 36 months |
| `StrategyCard` | SimulationResultsTable | v2.0 — one row: strategy name, weights, return range, Apply Weights button |

---

## State Management

| Layer | Technology | What It Holds |
|---|---|---|
| Server state | TanStack Query (React Query) | All API responses — cached and invalidated on mutations |
| Global UI state | React Context (SessionContext) | Supabase session, user profile, USD toggle state, silo count |
| Local UI state | useState / useReducer | Form inputs, modal open/close, wizard step |

**Cache invalidation rules:**

| Mutation | Invalidate |
|---|---|
| `POST /silos/:id/sync` | `['silos', id]`, `['holdings', id]`, `['profile']` |
| `POST /silos` | `['silos']`, `['profile']` |
| `DELETE /silos/:id` | `['silos']`, `['profile']` |
| `PUT /target-weights` | `['target-weights', id]`, `['silos', id]` |
| `PATCH /holdings` | `['holdings', id]`, `['silos', id]` |
| `POST /rebalance/execute` | `['holdings', id]`, `['sessions', id]`, `['silos', id]` |
| `PATCH /profile` | `['profile']` |
