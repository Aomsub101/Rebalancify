# Component 1 — Auth & Foundation

## 1. The Goal

Establish the entire application stack — a fully configured Supabase project with PostgreSQL schema (including pgvector and pg_cron extensions), a Next.js 15 application with TypeScript and Tailwind v3, JWT-based authentication, and a session-aware AppShell layout. Every other component in the system depends on this foundation; nothing else can be built until the database schema, auth flow, and authenticated shell are in place.

---

## 2. The Problem It Solves

A multi-tenant SaaS application serving retail investors must isolate each user's portfolio data completely. Without a properly configured database with Row Level Security (RLS), a Supabase project with the correct extensions, and a verified authentication flow, subsequent features (holdings, rebalancing, broker syncs) would either lack isolation or require retrofitting. The AppShell provides the consistent navigation chrome that makes the app feel cohesive across all pages.

---

## 3. The Proposed Solution / Underlying Concept

### Database Layer

Supabase hosts the PostgreSQL database. Two critical extensions must be enabled at project creation:

- **pgvector** (v2.0) — required for the AI Research Hub's semantic search in Phase 8
- **pg_cron** — required for the daily drift digest and news cache purge jobs

All user-data tables have RLS enabled (`rowsecurity = TRUE`). A single auth trigger (`on_auth_user_created`) automatically creates a `user_profiles` row when a new user signs up via Supabase Auth.

### Authentication

Supabase Auth provides email/password authentication. Two client libraries are used:

- `lib/supabase/client.ts` — browser-side client (for React components)
- `lib/supabase/server.ts` — server-side client (for API routes, uses `cookies()` from Next.js)

`middleware.ts` intercepts all requests to dashboard routes (`/(dashboard)/*`). If no valid JWT is present, the user is redirected to `/login`.

### Application Shell

The `AppShell` is rendered by `app/(dashboard)/layout.tsx` and wraps every authenticated page. It consists of:

- **Sidebar** (`bg-sidebar` — always dark regardless of theme) containing logo, nav items (Overview, Silos [X/5], News, Discover, Settings), and UserMenu
- **TopBar** with page title and NotificationBell
- **BottomTabBar** (mobile < 768px only — replaces sidebar)
- **OfflineBanner** (shown when `navigator.onLine = false`)

`SessionContext` provides global UI state: the Supabase session object, the USD conversion toggle, and the active silo count (`SiloCountBadge`).

### Styling

Tailwind CSS v3 is pinned at `3.x.x` — v4 uses a different CSS import syntax that breaks the token definitions. CSS variable tokens for all design system colours (`--sidebar-background`, `--card`, `--foreground`, etc.) are defined in `app/globals.css` and mirrored in `styles/globals.css`.

### Dev/Test Infrastructure

- **Vitest** for unit/integration tests (`pnpm test`, `pnpm test:coverage`)
- **Playwright** for E2E tests (`pnpm test:e2e`)
- **TanStack Query** for server-state management (React Query)
- **Sonner** for toast notifications (`<Toaster>` mounted at root layout)

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Auth flow | Sign up → email verify → login → redirect to `/overview` |
| Unauthenticated redirect | Access `/overview` without session → redirected to `/login` |
| RLS isolation | User A creates silo → User B's JWT cannot SELECT it |
| Auth trigger | Create test user via Supabase Auth dashboard → `user_profiles` row auto-created |
| Sidebar dark mode | Sidebar remains `bg-sidebar` (navy) in both light and dark theme |
| OfflineBanner | Toggle DevTools Network offline → banner appears; restore → banner disappears |
| SiloCountBadge | Create/delete a silo in a second browser tab → badge updates reactively |
| Tailwind tokens | `bg-card`, `text-foreground`, `bg-primary` resolve correctly in browser |
| Sonner toaster | Call `toast('Test')` in browser console → toast appears bottom-right |
| Build | `pnpm build` passes with zero errors |
| TypeScript | `pnpm type-check` passes with zero errors |
| Tests | `pnpm test` runs with exit 0 |

---

## 5. Integration

### APIs / Routes
- `lib/supabase/client.ts` — consumed by all React components needing DB access
- `lib/supabase/server.ts` — consumed by all API route handlers
- `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`, `app/(auth)/reset-password/page.tsx`
- `GET /api/profile` (STORY-005) — returns user profile including `notification_count`
- `PATCH /api/profile` (STORY-005) — updates `display_name`, `drift_notif_channel`, and encrypted broker keys

### Contexts
- `SessionContext` — provides `{ session, profile, siloCount, setSiloCount, showUsd, setShowUsd }` to the entire component tree

### Shared Components (from this component, used everywhere)
- `components/layout/Sidebar.tsx`
- `components/layout/TopBar.tsx`
- `components/layout/BottomTabBar.tsx`
- `components/shared/OfflineBanner.tsx`
- `components/shared/LoadingSkeleton.tsx`
- `components/shared/ErrorBanner.tsx`
- `components/shared/EmptyState.tsx`

### Other Components That Depend on This
- **All components** — the AppShell is the immutable parent of every authenticated page
- `SessionContext` values (`siloCount`, `showUsd`) are consumed by Portfolio Data Layer (Component 2), Rebalancing Engine (Component 3), and Discovery (Component 7)

### External Services
- **Supabase Auth** — email/password auth, JWT issuance
- **Supabase PostgreSQL** — database (pgvector, pg_cron extensions)
- **Vercel** — deployment target for `main` branch and PR preview URLs
- **Resend** — email delivery (SDK configured here, used in STORY-020 for drift digest)
