# Component 09 — PWA & Cross-Cutting UI: Implementation Plan

## Overview

Progressive web app shell, offline resilience, standard loading/error/empty states, first-session onboarding, progress tracker, and persistent "not financial advice" disclaimer. Cross-cutting concerns consumed by all other components.

## Dependencies

- **Component 01:** Auth Foundation (AppShell, SessionContext)
- **Component 02:** Portfolio Data Layer (silo data for onboarding/progress)
- **All components:** LoadingSkeleton, ErrorBanner, EmptyState used everywhere

## Architecture Reference

- `docs/architecture/components/09_pwa_cross_cutting_ui/`

---

## Sprint 1 — PWA Configuration & Service Worker

**Goal:** next-pwa setup, manifest, service worker caching strategy.

| Task | File | Summary |
|------|------|---------|
| TS.1.1 | `sprint1/TS.1.1_pwa_configuration.md` | next-pwa config, manifest.json, icons |
| TS.1.2 | `sprint1/TS.1.2_service_worker.md` | NetworkFirst for APIs, CacheFirst for static assets |
| TS.1.3 | `sprint1/TS.1.3_offline_enhancements.md` | Disable live features offline, show cached data |

---

## Sprint 2 — Onboarding & Progress

**Goal:** First-login onboarding modal, post-onboarding progress banner.

| Task | File | Summary |
|------|------|---------|
| TS.2.1 | `sprint2/TS.2.1_onboarding_modal.md` | Non-dismissible modal with 7 platform cards |
| TS.2.2 | `sprint2/TS.2.2_progress_banner.md` | Reactive step tracker, server-side dismiss |

---

## Sprint 3 — Shared UI Components

**Goal:** LoadingSkeleton, ErrorBanner, EmptyState, FooterDisclaimer standardization.

| Task | File | Summary |
|------|------|---------|
| TS.3.1 | `sprint3/TS.3.1_loading_skeleton.md` | LoadingSkeleton for all useQuery callsites |
| TS.3.2 | `sprint3/TS.3.2_error_banner.md` | ErrorBanner with error code, message, retry |
| TS.3.3 | `sprint3/TS.3.3_empty_state.md` | EmptyState with icon, description, CTA |
| TS.3.4 | `sprint3/TS.3.4_footer_disclaimer.md` | "Not financial advice" on every page |

---

## Sprint 4 — Audits & Testing

**Goal:** Audit all components for loading/error/empty states, Lighthouse PWA.

| Task | File | Summary |
|------|------|---------|
| TS.4.1 | `sprint4/TS.4.1_skeleton_audit.md` | grep useQuery → verify LoadingSkeleton |
| TS.4.2 | `sprint4/TS.4.2_error_audit.md` | grep useQuery → verify ErrorBanner |
| TS.4.3 | `sprint4/TS.4.3_performance_audit.md` | Lighthouse PWA ≥ 90, calc < 2s, news < 3s |
| TS.4.4 | `sprint4/TS.4.4_e2e_tests.md` | E2E: PWA install, offline, onboarding, progress |
