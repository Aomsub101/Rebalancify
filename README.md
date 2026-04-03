# Rebalancify

Portfolio clarity for every platform.

Rebalancify is a Next.js + Supabase application for tracking silo-based portfolios, monitoring drift, calculating rebalance orders, reviewing execution history, reading portfolio-aware news, exploring related assets, and running research workflows backed by a user-supplied LLM key.

## Current Product Surface

The current codebase includes these user-facing areas:

- Authenticated dashboard shell with `Overview`, `Silos`, `News`, `Discover`, `Settings`, and ticker-specific `Research` pages
- Silo CRUD with per-silo base currency, drift threshold, and holdings/target-weight management
- Rebalance wizard with calculate, review, execute, and per-silo history flows
- Portfolio overview with drift summaries and optional USD display conversion
- Portfolio news and macro news feeds with refresh, caching, and article state tracking
- Asset search, top movers, and peer discovery
- AI Research Hub page for `/research/[ticker]`
- Knowledge-base ingest/upload endpoints and research corpus size tracking
- Portfolio optimization proxy route to a Railway-hosted Python service
- PWA assets via `manifest.json` and generated service worker files

## Tech Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS v3
- TanStack Query
- Supabase Auth + Postgres
- Vercel deployment target for the web app
- Railway-hosted Python service for optimization
- Vitest and Playwright for testing

## Main Directories

- `app/`: App Router pages and API routes
- `components/`: UI components and feature views
- `contexts/`: auth and UI state providers
- `hooks/`: client hooks
- `lib/`: shared domain logic, API helpers, services, and types
- `knowledge/`: default markdown corpus for the research feature
- `api/`: Python optimization service code and config
- `docs/`: architecture, plans, design, and development notes
- `stories/`: product stories and implementation slices

## Key Flows In Code

- Auth flow with Supabase clients, middleware protection, and profile API
- Silo creation and editing, holdings management, target weights, and drift checks
- Rebalance calculation and execution routes with immutable session history
- Alpaca credential storage and platform settings in the dashboard settings page
- News refresh/query stack backed by `lib/newsService.ts` and `lib/newsQueryService.ts`
- Research generation and caching through `/api/research/[ticker]`
- Knowledge ingest and upload through `/api/knowledge/*`
- Optimization proxy through `/api/optimize`

## Local Development

Install dependencies with either `npm` or `pnpm`. The repo currently includes both `package-lock.json` and `pnpm-lock.yaml`.

```bash
git clone https://github.com/Aomsub101/Rebalancify.git
cd Rebalancify
npm install
cp .env.example .env.local
npm run dev
```

If you prefer `pnpm`, use `pnpm install` and `pnpm dev` instead.

Open `http://localhost:3000`. The root route redirects to `/overview`.

## Environment Variables

Use `.env.example` as the source of truth. The current app expects configuration for:

- Supabase
- Encryption key
- Finnhub, FMP, Resend, and ExchangeRate APIs
- Schwab OAuth
- Embedding provider for knowledge ingestion
- Railway optimization proxy
- Cron authentication

## Useful Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run type-check
npm run test
npm run test:coverage
npm run test:e2e
```

## Verification

Recent refactor verification was run with:

```bash
npx vitest run lib/__tests__/profileApi.test.ts lib/__tests__/overview.test.ts lib/__tests__/rebalanceUi.test.ts app/api/profile/__tests__/route.test.ts app/api/silos/__tests__/route.test.ts app/api/silos/[silo_id]/holdings/__tests__/route.test.ts app/api/silos/[silo_id]/rebalance/calculate/__tests__/route.test.ts app/api/silos/[silo_id]/rebalance/execute/__tests__/route.test.ts lib/rebalanceEngine.test.ts
npx tsc --noEmit
```

## Documentation

- `docs/plans/`: implementation plans and progress tracking
- `docs/architecture/`: schema, contracts, and component architecture
- `docs/development/`: local setup and engineering workflow notes
- `docs/design/`: UX and UI references
- `PROGRESS.md`: running implementation log

The latest refactor progress summary for plans `01`, `02`, and `03` is in `docs/plans/PLAN_PROGRESS.md`.

## Licensing Status

`package.json` currently declares `ISC`, but there is no root `LICENSE` file checked into the repository at the moment. Treat the repository license state as needing confirmation before redistribution.

## Disclaimer

This software is for informational and educational use. It is not financial advice, and all investment decisions remain the user's responsibility.
