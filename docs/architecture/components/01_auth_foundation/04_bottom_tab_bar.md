# Sub-Component: Bottom Tab Bar

## 1. The Goal

Provide a mobile-only fixed bottom navigation bar that mirrors the desktop Sidebar, giving phone users access to the same five nav destinations without a persistent side rail consuming precious horizontal space.

---

## 2. The Problem It Solves

On mobile devices, a 240px sidebar would consume most of the screen width. The bottom tab bar solves this by using a compact icon + label layout fixed to the bottom of the viewport, accessible with one-handed use while leaving the full content area available.

---

## 3. The Proposed Solution / Underlying Concept

### Visibility

- Uses `className="fixed bottom-0 left-0 right-0 z-50 md:hidden"`
- Hidden at `md` breakpoint (768px) and above
- Renders on top of content (z-50) with `pb-safe` for device home indicator clearance

### Tab Items

Same `NAV_ITEMS` as the Sidebar:
```typescript
const TAB_ITEMS = [
  { href: '/overview',  label: 'Overview',  icon: Home },
  { href: '/silos',     label: 'Silos',     icon: PieChart },
  { href: '/news',      label: 'News',      icon: Newspaper },
  { href: '/discover',   label: 'Discover',  icon: Compass },
  { href: '/settings',  label: 'Settings',  icon: Settings2 },
]
```

### Dirty State Indicator

When `useDirtyState().isDirty === true` and the current route is `/silos`, a small amber dot (`h-2 w-2 rounded-full bg-amber-400`) appears at the top-right corner of the Silos tab icon. The non-colour signal is a screen-reader-only label: `aria-label="Unsaved changes"`.

### Silo Count

```typescript
// Rendered on the Silos tab below the icon
<span aria-label={`${siloCount} of 5 silos used`}>[{siloCount}/5]</span>
```

### Navigation Guard

Same `confirmNavigation()` pattern as Sidebar — if the user has unsaved changes and tries to navigate away from `/silos`, the navigation is blocked until confirmed.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Tab bar visible on mobile | Resize viewport to < 768px; bottom bar appears |
| Tab bar hidden on desktop | Resize viewport to ≥ 768px; bottom bar not rendered |
| Active tab highlighted | Navigate to News; News tab uses `text-primary` |
| Dirty dot on Silos | Make unsaved change; amber dot appears on Silos tab |
| Navigation guard fires | Unsaved change → tap Settings → confirm/cancel dialog |
| `pnpm test` | `BottomTabBar.test.tsx` (if present) passes |
