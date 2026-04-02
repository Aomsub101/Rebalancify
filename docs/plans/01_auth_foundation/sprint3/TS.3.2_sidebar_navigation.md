# TS.3.2 — Sidebar Navigation

## Task
Build the desktop sidebar with logo, navigation items, SiloCountBadge, and UserMenu.

## Target
`components/layout/Sidebar.tsx`

## Inputs
- `docs/architecture/components/01_auth_foundation/sidebar_navigation.md`
- `docs/architecture/04-component-tree.md` §2.1

## Process
1. Create `components/layout/Sidebar.tsx`:
   - Fixed width (w-64), full height, `bg-sidebar` (always dark regardless of theme)
   - Logo section: wordmark + R mark at top
   - Navigation items (using `next/link` with `usePathname()` for active state):
     - Overview (`/overview`)
     - Silos (`/silos`) + `SiloCountBadge` showing `[X/5]`
     - News (`/news`)
     - Discover (`/discover`)
     - Settings (`/settings`)
   - Active item: highlighted background, bold text
   - UserMenu at bottom: avatar placeholder, display_name, email, sign-out button
2. Sign-out calls `supabase.auth.signOut()` then redirects to `/login`
3. `SiloCountBadge` reads from SessionContext (`siloCount`)

## Outputs
- `components/layout/Sidebar.tsx`
- `components/layout/SiloCountBadge.tsx`
- `components/layout/UserMenu.tsx`

## Verify
- All 5 nav items render and link correctly
- Active route highlighted
- SiloCountBadge shows correct count
- Sign-out clears session and redirects

## Handoff
→ TS.3.3 (TopBar)
