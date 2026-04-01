# Sub-Component: App Shell Layout

## 1. The Goal

Provide a single layout wrapper rendered by `app/(dashboard)/layout.tsx` that composes the authenticated shell: sidebar, topbar, offline banner, onboarding gate, and main content area. This is the immutable parent of every authenticated page in the application.

---

## 2. The Problem It Solves

Every authenticated page requires the same chrome: navigation sidebar, top header, offline warning, and onboarding modal. Without a shared layout, each page would have to independently compose these, leading to duplication and inconsistency. The dashboard layout solves this by wrapping `{children}` in a single, stable shell.

---

## 3. The Proposed Solution / Underlying Concept

### Layout Composition

```
DashboardLayout
├── DirtyStateProvider          (prevents accidental navigation with unsaved changes)
├── div (flex h-screen overflow-hidden)
│   ├── Sidebar                 (desktop: visible; tablet: icon rail; mobile: hidden)
│   └── div (flex-col flex-1 min-w-0 overflow-hidden)
│       ├── TopBar              (page title + USD toggle + notification bell)
│       ├── OfflineBanner       (conditionally shown when offline)
│       ├── main (flex-1 overflow-auto p-6 pb-20 md:pb-6)
│       │   ├── OnboardingGate  (shows onboarding modal/progress banner if needed)
│       │   └── {children}      (the actual page content)
│       └── BottomTabBar        (mobile only: fixed bottom nav)
```

### Key Implementation Facts

- `DashboardLayout` is a React Server Component (no `'use client'` directive)
- `OnboardingGate` and `DirtyStateProvider` are client components that consume `SessionContext`
- Bottom padding on `<main>` is `pb-20` on mobile (accounts for BottomTabBar) and `pb-6` on desktop
- `overflow-hidden` on the outer shell prevents double-scrollbars
- The layout is route-grouped under `(dashboard)` — this grouping has no URL segment, only a layout boundary

### DirtyState Context

`DirtyStateProvider` wraps the entire shell. It tracks whether the user has unsaved changes and provides a `confirmNavigation()` function that prompts before navigating away. The Sidebar and BottomTabBar both call `confirmNavigation()` before allowing navigation to a new silo route.

### Providers Wrapped

| Provider | Purpose |
|---|---|
| `DirtyStateProvider` | Unsaved-changes guard for navigation |
| `SessionProvider` | Must be higher in the tree — injected by `app/layout.tsx` |

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| All 5 nav items visible on desktop | Navigate to any dashboard page, sidebar shows all items |
| BottomTabBar shows on mobile | Resize viewport to < 768px, tab bar appears |
| Sidebar hidden on mobile | Resize viewport to < 768px, sidebar not rendered |
| OnboardingGate renders | User with `onboarded=false` sees the onboarding modal |
| Main content scrollable | Page content overflows; main area scrolls, sidebar does not |
| `pnpm build` | Layout compiles without errors |
