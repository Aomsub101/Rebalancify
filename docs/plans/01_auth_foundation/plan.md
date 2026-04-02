# Component 01 — Auth & Foundation: Implementation Plan

## Overview

Establish the full application stack: Supabase (PostgreSQL + pgvector + pg_cron + RLS), Next.js 15 App Router (TypeScript, Tailwind v3), JWT auth, and AppShell layout. Root dependency for all other components.

## Dependencies

- **External:** Supabase, Vercel, Resend SDK
- **Internal:** None — root component

## Architecture Reference

- `docs/architecture/components/01_auth_foundation/`
- `docs/architecture/02-database-schema.md`

---

## Sprint 1 — Database & Supabase Setup

**Goal:** Live Supabase with full schema, extensions, RLS, auth trigger.

| Task | File | Summary |
|------|------|---------|
| TS.1.1 | `sprint1/TS.1.1_supabase_project_setup.md` | Create project, enable pgvector + pg_cron |
| TS.1.2 | `sprint1/TS.1.2_run_all_migrations.md` | Run all migrations in dependency order |
| TS.1.3 | `sprint1/TS.1.3_auth_trigger.md` | Auto-create user_profiles on signup |
| TS.1.4 | `sprint1/TS.1.4_rls_policies.md` | Verify RLS on all user-data tables |

---

## Sprint 2 — Next.js Scaffold & Auth Flow

**Goal:** Working auth flow with route protection.

| Task | File | Summary |
|------|------|---------|
| TS.2.1 | `sprint2/TS.2.1_nextjs_scaffold.md` | App Router + Tailwind + TanStack Query + TS |
| TS.2.2 | `sprint2/TS.2.2_supabase_client_layer.md` | Browser + server Supabase clients |
| TS.2.3 | `sprint2/TS.2.3_auth_pages.md` | Login, Signup, Reset-Password pages |
| TS.2.4 | `sprint2/TS.2.4_auth_middleware.md` | Protect dashboard routes via middleware.ts |

---

## Sprint 3 — AppShell & Navigation

**Goal:** Authenticated shell with sidebar, topbar, mobile nav.

| Task | File | Summary |
|------|------|---------|
| TS.3.1 | `sprint3/TS.3.1_app_shell_layout.md` | Dashboard layout wrapper |
| TS.3.2 | `sprint3/TS.3.2_sidebar_navigation.md` | Sidebar with nav items + UserMenu |
| TS.3.3 | `sprint3/TS.3.3_topbar_header.md` | TopBar with PageTitle + NotificationBell |
| TS.3.4 | `sprint3/TS.3.4_bottom_tab_bar.md` | Mobile bottom nav (< 768px) |

---

## Sprint 4 — Session Context & Global State

**Goal:** SessionContext providing session, profile, USD toggle, silo count.

| Task | File | Summary |
|------|------|---------|
| TS.4.1 | `sprint4/TS.4.1_session_context.md` | SessionContext provider + consumer hook |
| TS.4.2 | `sprint4/TS.4.2_profile_api.md` | GET/PATCH /api/profile endpoints |
| TS.4.3 | `sprint4/TS.4.3_offline_banner.md` | OfflineBanner in AppShell |
| TS.4.4 | `sprint4/TS.4.4_shared_utilities.md` | Toaster (Sonner), CSS tokens, formatNumber |

---

## Sprint 5 — Deployment & Testing

**Goal:** Vercel deployment, CI, test infrastructure.

| Task | File | Summary |
|------|------|---------|
| TS.5.1 | `sprint5/TS.5.1_vercel_deployment.md` | Vercel project + env vars + preview URLs |
| TS.5.2 | `sprint5/TS.5.2_test_infrastructure.md` | Vitest + Playwright config |
| TS.5.3 | `sprint5/TS.5.3_auth_e2e_tests.md` | E2E: signup → login → dashboard flow |
| TS.5.4 | `sprint5/TS.5.4_rls_integration_tests.md` | Cross-user isolation tests |
