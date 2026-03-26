# STORY-003 — AppShell (Sidebar, TopBar, Mobile Nav)

**Epic:** EPIC-01 — Foundation
**Phase:** 0
**Estimate:** S (1–2 days)
**Status:** 🔲 Not started
**Depends on:** STORY-002
**Blocks:** All UI stories (every page lives inside the AppShell)

---

## User Story

As an authenticated user, I see a consistent navigation shell — sidebar on desktop, bottom tab bar on mobile — that lets me navigate between all major sections.

---

## Acceptance Criteria

1. `app/(dashboard)/layout.tsx` renders `AppShell` wrapping all dashboard routes.
2. Sidebar is always dark (`bg-sidebar`) regardless of light/dark mode. (`bg-sidebar` = `hsl(var(--sidebar-background))` via tailwind.config.js)
3. Sidebar contains: Logo (wordmark), NavItems (Overview, Silos [X/5], News, Discover, Settings), UserMenu (avatar, display_name, sign-out).
4. `SiloCountBadge` shows `[X/5]` pulled from `SessionContext.siloCount`. Updates reactively.
5. Active NavItem is highlighted with `bg-sidebar-primary` background.
6. TopBar shows page title + `NotificationBell` with badge count.
7. On screens < 1024px: sidebar collapses to a 56px icon-only rail.
8. On mobile (< 768px): sidebar hidden entirely; `BottomTabBar` shown with 5 tabs (Overview, Silos, News, Discover, Settings).
9. `OfflineBanner` appears at top of content area when `navigator.onLine = false`. Dismissed when online is restored.
10. Navigating between routes does not re-mount AppShell — only `<children />` re-renders.

---

## Tasks

- [ ] Write `components/layout/Sidebar.tsx` (dark, always — variable tokens)
- [ ] Write `components/layout/TopBar.tsx` (title + NotificationBell)
- [ ] Write `components/layout/BottomTabBar.tsx` (mobile only)
- [ ] Write `components/shared/OfflineBanner.tsx`
- [ ] Write `app/(dashboard)/layout.tsx` wiring everything together
- [ ] Verify sidebar remains dark in dark mode
- [ ] Verify SiloCountBadge updates when a silo is created or deleted (Phase 1+ test)
- [ ] Verify OfflineBanner on/offline behaviour

---

## Definition of Done

- [ ] All 10 acceptance criteria verified
- [ ] Sidebar dark on both light and dark mode (screenshot both)
- [ ] No Tailwind inline style overrides
- [ ] `GET /api/profile` returns `notification_count` — verified via DevTools Network tab
- [ ] `SiloCountBadge` updates reactively when a silo is created or deleted (manual test using another browser tab)
- [ ] All 5 NavItems are keyboard-reachable via Tab; active item has visible focus ring
- [ ] `OfflineBanner` appears and disappears correctly (toggle DevTools → Network → Offline)
- [ ] `LoadingSkeleton` visible during `GET /api/profile` pending state (throttle network to Slow 3G)
- [ ] `ErrorBanner` visible if `GET /api/profile` fails (block request in DevTools)
- [ ] RLS verified — `user_profiles` row accessible only by owning user (two-user JWT test)
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] Sidebar is `bg-sidebar` in both light and dark mode — visually confirmed (navy, never changes)
- [ ] Sidebar collapses to 56px rail at < 1024px (matches STORY-003 AC-7 breakpoint)
- [ ] `BottomTabBar` appears at < 768px, sidebar hidden
- [ ] `OfflineBanner` appears when `navigator.onLine = false` (simulate in DevTools)
- [ ] `SiloCountBadge` updates reactively on silo create/delete
- [ ] Route change does not re-mount AppShell (verify with React DevTools)
- [ ] All NavItems have visible focus ring
- [ ] No console errors on route transitions
- [ ] `pnpm test` passes with zero failures
- [ ] `<Toaster>` is mounted and accessible (verified in STORY-002 — confirm it has not been removed)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] `bd close <task-id> "STORY-003 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] Every page implemented in this story exports a `metadata` object or `generateMetadata` function following the format `[Page Name] | Rebalancify`
