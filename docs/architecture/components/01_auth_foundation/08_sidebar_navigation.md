# Sub-Component: Sidebar Navigation

## 1. The Goal

Provide the primary desktop navigation rail — a fixed dark sidebar with the app logo, main nav items, active silo count, dirty-state indicator, and a user menu with sign-out — that remains persistent across all authenticated pages.

---

## 2. The Problem It Solves

Users navigating a complex portfolio app need consistent orientation: they must always know where they are, how to get to other sections, and how many silos they have used. The sidebar solves this by being permanently visible on desktop (≥1024px) with all navigation options, while collapsing to an icon-only rail on tablet (768px–1024px).

---

## 3. The Proposed Solution / Underlying Concept

### Responsive Behavior

| Viewport | Width | Content |
|---|---|---|
| Mobile (<768px) | Hidden | Not rendered |
| Tablet (768px–1024px) | 56px | Icon-only rail (no labels) |
| Desktop (≥1024px) | 240px | Full labels + logo + user menu |

### Navigation Items

```typescript
const NAV_ITEMS = [
  { href: '/overview',  label: 'Overview',  icon: Home },
  { href: '/silos',     label: 'Silos',     icon: PieChart },
  { href: '/news',      label: 'News',      icon: Newspaper },
  { href: '/discover',   label: 'Discover',  icon: Compass },
  { href: '/settings',  label: 'Settings',  icon: Settings2 },
]
```

### Silo Count Badge

```typescript
// Shown on the Silos nav item when on desktop
<span>[{siloCount}/5]</span>
```

`active_silo_count` is fetched via TanStack Query from `GET /api/profile`. The count is reactive — creating or deleting a silo in another tab triggers query invalidation and the badge updates automatically.

### Dirty State Indicator (AC9)

When `useDirtyState().isDirty === true` and the current route is `/silos`:
- Nav item background changes to amber: `bg-amber-500/20`
- Text changes to amber: `text-amber-400`
- A `text-amber-400` "unsaved" label appears alongside the nav label

### User Menu

- Displays user initials in a coloured avatar (first two letters of `display_name`, or `?` if no name)
- Shows `display_name` or `email` on desktop
- "Sign out" link calls `supabase.auth.signOut()` and redirects to `/login`
- User data fetched via `GET /api/profile` (display_name, notification_count)

### Always-Dark Background

`bg-sidebar` is always applied regardless of the user's system colour theme. The Tailwind class `bg-sidebar` resolves to `hsl(var(--sidebar-background))` — a navy token that never changes.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Sidebar visible on desktop, hidden on mobile | Resize viewport; check DevTools element visibility |
| Active route highlighted | Navigate to each page; current nav item has `bg-slate-800/50 text-white` |
| Silo count `[0/5]` shows | Fresh login shows correct initial count |
| Dirty state amber indicator | Make a change in Silos (without saving); nav item turns amber |
| Sign out redirects to `/login` | Click sign out; URL changes to /login |
| `pnpm test` | `Sidebar.test.tsx` (if present) passes |
