# docs/development/00-project-structure.md — Project Structure

## AGENT CONTEXT

**What this file is:** The canonical directory structure of the Next.js project, with the purpose of each folder and file.
**Derived from:** TECH_DOCS_v1.2.md (DOC-03 Routing Structure), PRD_v1.3.md Section 5.2
**Connected to:** docs/architecture/04-component-tree.md, docs/development/01-dev-environment.md, docs/design/05-theme-implementation.md (globals.css and tailwind.config.ts contents)
**Critical rules for agents using this file:**
- All external API calls live under `app/api/`. No exceptions.
- All shared utilities live under `lib/`. No inline utility functions in components.
- All Supabase migrations live under `supabase/migrations/` in numbered order.

---

## Directory Structure

```
rebalancify/
├── AGENTS.md                     ← Beads integration rules, mandatory session-end workflow (bd dolt push), non-interactive shell command rules
├── CLAUDE.md                     ← Master agent instructions (read first)
├── CONFLICT_RESOLVER.md          ← Authority hierarchy + runtime error resolution procedures
├── DEVELOPMENT_LOOP.md           ← 7-step story execution loop (single source of truth for process)
├── KICKSTART.md                  ← Mandatory first-read entry point for every session
├── PROGRESS.md                   ← Build tracker — story completion status
├── PROJECT_LOG.md                ← Implementation history log — one entry per completed story
├── README.md                     ← Public project overview
├── .beads/                       ← Beads task tracker (Dolt database). Do NOT read content; list only.
│   └── ...                       ← Managed by bd CLI — do not manually edit
│
├── app/                          ← Next.js App Router
│   ├── (auth)/                   ← Unauthenticated routes
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── reset-password/page.tsx
│   ├── (dashboard)/              ← Authenticated routes (wrapped by AppShell)
│   │   ├── layout.tsx            ← AppShell
│   │   ├── overview/page.tsx
│   │   ├── silos/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [silo_id]/
│   │   │       ├── page.tsx
│   │   │       ├── rebalance/page.tsx
│   │   │       └── history/page.tsx
│   │   ├── news/page.tsx
│   │   ├── discover/page.tsx
│   │   ├── research/[ticker]/page.tsx  ← v2.0
│   │   └── settings/page.tsx
│   ├── api/                      ← All external API proxying happens here
│   │   ├── profile/route.ts
│   │   ├── silos/
│   │   │   ├── route.ts
│   │   │   └── [silo_id]/
│   │   │       ├── route.ts
│   │   │       ├── sync/route.ts
│   │   │       ├── holdings/route.ts
│   │   │       ├── holdings/[holding_id]/route.ts
│   │   │       ├── asset-mappings/route.ts
│   │   │       ├── target-weights/route.ts
│   │   │       ├── drift/route.ts
│   │   │       └── rebalance/
│   │   │           ├── calculate/route.ts
│   │   │           ├── execute/route.ts
│   │   │           └── history/route.ts
│   │   ├── assets/
│   │   │   ├── search/route.ts
│   │   │   └── [asset_id]/peers/route.ts
│   │   ├── market/top-movers/route.ts
│   │   ├── news/
│   │   │   ├── portfolio/route.ts
│   │   │   ├── macro/route.ts
│   │   │   ├── refresh/route.ts
│   │   │   └── articles/[article_id]/state/route.ts
│   │   ├── fx-rates/route.ts
│   │   ├── rebalance/history/route.ts
│   │   └── research/[ticker]/route.ts  ← v2.0
│   ├── globals.css               ← CSS variable definitions only
│   └── layout.tsx                ← Root layout (Providers, fonts)
│
├── components/                   ← Reusable UI components
│   ├── ui/                       ← shadcn/ui primitives (auto-generated)
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   └── BottomTabBar.tsx      ← Mobile nav
│   ├── silo/
│   │   ├── SiloCard.tsx
│   │   ├── SiloHeader.tsx
│   │   ├── HoldingsTable.tsx
│   │   ├── HoldingRow.tsx
│   │   └── AssetSearchModal.tsx
│   ├── rebalance/
│   │   ├── RebalanceConfigPanel.tsx
│   │   ├── OrderReviewPanel.tsx
│   │   └── ExecutionResultPanel.tsx
│   ├── shared/
│   │   ├── DriftBadge.tsx
│   │   ├── PlatformBadge.tsx
│   │   ├── ExecutionModeTag.tsx
│   │   ├── AlpacaLiveBadge.tsx
│   │   ├── ErrorBanner.tsx
│   │   ├── LoadingSkeleton.tsx
│   │   ├── EmptyState.tsx
│   │   ├── OfflineBanner.tsx
│   │   ├── ConfirmDialog.tsx
│   │   └── PriceDisplay.tsx
│   └── news/
│       ├── ArticleCard.tsx
│       └── RateLimitBanner.tsx
│
├── lib/                          ← Shared utilities and clients
│   ├── supabase/
│   │   ├── client.ts             ← Browser Supabase client
│   │   └── server.ts             ← Server-side Supabase client (API routes)
│   ├── encryption.ts             ← AES-256-GCM encrypt/decrypt
│   ├── formatNumber.ts           ← ALL number formatting (see design docs)
│   ├── priceService.ts           ← Three-tier price fetching logic
│   └── rebalanceEngine.ts        ← Calculation logic (partial + full modes)
│
├── contexts/
│   └── SessionContext.tsx        ← Global: session, profile, USD toggle, silo count
│
├── hooks/
│   ├── useProfile.ts
│   ├── useSilos.ts
│   ├── useHoldings.ts
│   └── useDirtyGuard.ts              ← Registers beforeunload listener when isDirty=true; prevents accidental navigation away from unsaved weight edits and Settings forms
│
├── knowledge/                    ← Default RAG corpus (v2.0) — .md files
│
├── supabase/
│   ├── migrations/               ← SQL migration files (numbered 01–18)
│   └── config.toml
│
├── public/
│   ├── manifest.json             ← PWA manifest
│   └── icons/                   ← PWA icons
│
├── sector_taxonomy.json          ← Static peer fallback for Discover
├── vercel.json                   ← Vercel Cron Job schedule (drift digest at 08:00 UTC)
├── vitest.config.ts              ← Vitest test runner config (unit + integration tests)
├── playwright.config.ts          ← Playwright E2E test config (baseURL: http://localhost:3000, Chromium only)
├── tests/                        ← Playwright E2E test files
│   └── example.spec.ts           ← Placeholder smoke test (replace before STORY-029)
├── test-utils/
│   ├── setup.ts                  ← Vitest global setup (@testing-library/jest-dom)
│   └── mock-request.ts           ← Helper to create mock Next.js Request objects for route handler tests
├── .github/
│   └── workflows/
│       └── ci.yml               ← GitHub Actions CI pipeline (type-check + test + build on every push)
├── middleware.ts                 ← JWT validation, route protection
├── tailwind.config.ts            ← Tailwind config with CSS variable mapping (see docs/design/05-theme-implementation.md)
├── components.json               ← shadcn/ui configuration (style: new-york)
├── app/globals.css               ← CSS variables — theme tokens (HSL format)
├── styles/globals.css            ← Mirror of app/globals.css — kept identical
└── next.config.mjs               ← Next.js config with next-pwa
```
