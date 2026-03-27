# PROJECT_LOG.md — Rebalancify Implementation History

## AGENT CONTEXT

**What this file is:** A living implementation history log — one entry per completed story. Agents scan the last 3–5 entries at the start of every session to understand recent decisions, discovered issues, and carry-over notes.
**Derived from:** BMAD-inspired project logging practice
**Connected to:** PROGRESS.md (status tracker), CLAUDE.md (master rules), all STORY-*.md files
**Critical rules for agents using this file:**
- Add a new entry at the TOP of the Completed Stories section every time a story is marked complete.
- Never edit past entries — they are append-only history.
- Keep each entry concise: ~10–15 lines. Expand only if there is a critical discovery.
- Scan the last 3–5 entries before starting any new story.

---

## Entry Template

Copy this block to the top of the Completed Stories section when closing a story:

```
### STORY-[NNN] — [Title]
**Completed:** YYYY-MM-DD
**Effort:** [actual vs estimated — e.g., "1 day (estimated 1)"]

**What was built:**
- [Bullet: key file or feature delivered]
- [Bullet: key file or feature delivered]

**Decisions made:**
- [Decision + reason — e.g., "Used X instead of Y because Z"]

**Discovered issues / carry-over notes:**
- [Issue or note that future stories must know — e.g., "Supabase free tier does not support X; workaround in lib/Y.ts"]

**Quality gates passed:** type-check ✅ | test ✅ | build ✅ | RLS ✅
```

---

## Completed Stories

### STORY-003 — AppShell (Sidebar, TopBar, Mobile Nav)
**Completed:** 2026-03-27
**Effort:** 0.5 day (estimated S / 1–2 days — all UI, no migrations)

**What was built:**
- `components/layout/Sidebar.tsx` — always-dark `bg-sidebar` nav rail; 240px desktop, 56px icon rail at 768–1023px, hidden < 768px; active state via `usePathname()`; UserMenu with sign-out; SiloCountBadge from SessionContext
- `components/layout/TopBar.tsx` — page title (pathname map) + NotificationBell (hardcoded 0; TODO STORY-005)
- `components/layout/BottomTabBar.tsx` — fixed bottom 5-tab bar, visible only < 768px; `pb-safe` utility for iOS safe-area
- `components/shared/OfflineBanner.tsx` — SSR-safe online/offline detection; amber warning banner with WifiOff icon
- `app/(dashboard)/layout.tsx` — server component assembling the full shell
- `app/(dashboard)/overview/page.tsx` — stub page with metadata + disclaimer footer (needed because middleware redirects to /overview)
- `.pb-safe` utility added to both `app/globals.css` and `styles/globals.css` (must stay in sync)

**Decisions made:**
- `app/api/profile/route.ts` intentionally excluded — belongs to STORY-005; creating partial route now would conflict with full response shape. NotificationBell uses hardcoded 0 with TODO comment.
- `BottomTabBar` uses `pb-safe` CSS utility (not inline `style={}`) for `env(safe-area-inset-bottom)` to comply with CLAUDE.md Rule 2

**Discovered issues / carry-over notes:**
- `git push` fails — SSH key not configured on this machine. All commits are local; user must push manually or configure SSH key before CI runs.
- DoD item "GET /api/profile returns notification_count" deferred to STORY-005

**Quality gates passed:** type-check ✅ | test ✅ | build ✅

---

### STORY-002 — Next.js Scaffold, Auth, and Middleware
**Completed:** 2026-03-26
**Effort:** 1 day (estimated M / 3–5 days — focused scope ran faster)

**What was built:**
- Next.js 15 + React 19 + TypeScript 5 App Router installed; Tailwind v3 pinned at 3.4.19 exact
- `lib/utils.ts` (cn), `lib/supabase/client.ts`, `lib/supabase/server.ts` — all TDD Red→Green; 13/13 tests pass; 100%/100%/95.83% coverage
- `tailwind.config.ts` + `app/globals.css` + `styles/globals.css` (mirror) with full design-system tokens
- `middleware.ts` — unauthenticated → /login, authenticated hitting auth routes → /overview
- Auth pages: login, signup, reset-password (server component + metadata + separate client form component)
- `contexts/SessionContext.tsx`, `components/providers.tsx` (QueryClient + SessionProvider), `app/layout.tsx`
- Sonner `<Toaster>` at root; `components.json` for shadcn; `resend` installed for Phase 4

**Decisions made:**
- Downgraded `@vitejs/plugin-react` to `^4.7.0` (v6 imports `vite/internal` which only exists in vite 8; vitest 3 bundles vite 7)
- Added `globals: true` to vitest config — required for `@testing-library/jest-dom` to call `expect.extend()` globally
- `tsconfig.json` `@/*` alias fixed from `./src/*` to `./*` (no src/ directory; all files at root)
- `app/page.tsx` is just `redirect('/overview')` — middleware handles unauthenticated case before page renders
- Auth forms use server wrapper for `metadata` export + separate `'use client'` component for interactivity

**Discovered issues / carry-over notes:**
- `cookies()` is async in Next.js 15 — `lib/supabase/server.ts` must `await cookies()` (already done)
- Tailwind pin: `pnpm add tailwindcss@3 --save-exact` still wrote `^3.4.19`; had to manually remove `^` in package.json
- `next-env.d.ts` auto-generated by Next.js build — do not delete; do not manually edit

**Quality gates passed:** type-check ✅ | test ✅ | build ✅

---

### STORY-001 — Supabase Setup & All Migrations
**Completed:** 2026-03-26
**Effort:** 1 day (estimated M / 3–5 days — migration-only story ran faster than estimated)

**What was built:**
- `supabase/migrations/` with 18 SQL files covering all tables, RLS policies, indexes, views, and pg_cron jobs
- Minimal toolchain: `tsconfig.json` (scoped include/exclude), `vitest.config.ts` (passWithNoTests, excludes Playwright tests), `package.json` updated with typescript + vitest + @vitest/coverage-v8
- Updated `.gitignore` to exclude `.env`, `coverage/`, `tsconfig.tsbuildinfo`, `.claude/`, `package-lock.json`

**Decisions made:**
- `pnpm build` stubbed as echo for STORY-001 (no Next.js installed); STORY-002 will replace with `next build`
- `vitest.config.ts` uses `passWithNoTests: true` — unit tests begin in STORY-002 with first `lib/` files
- `tsconfig.json` uses explicit `"include": ["**/*.ts", "**/*.tsx"]` + `"exclude": ["node_modules", ".beads", "supabase", ...]` to avoid scanning non-app directories
- migration 17 inserts in-app notifications only (ADR-013) — email via Vercel Cron in STORY-020

**Discovered issues / carry-over notes:**
- pnpm was not installed globally; installed via `npm install -g pnpm` before first `pnpm install`
- `bd dolt push` fails — Dolt remote not configured (non-blocking; beads state is local only until remote is set up)
- STORY-002 must overwrite `package.json` `build`/`dev`/`start`/`lint` scripts when scaffolding Next.js

**Quality gates passed:** type-check ✅ | test ✅ | build ✅ (stub) | RLS ✅ | auth trigger ✅ | RLS isolation ✅

---

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | Gate passed |
| ❌ | Gate failed — see story notes |
| ⚠️ | Passed with known caveat |
