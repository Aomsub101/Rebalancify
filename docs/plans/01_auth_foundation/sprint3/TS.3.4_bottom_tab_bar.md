# TS.3.4 — Bottom Tab Bar

## Task
Build mobile bottom navigation bar (visible < 768px only), replacing the sidebar.

## Target
`components/layout/BottomTabBar.tsx`

## Inputs
- `docs/architecture/components/01_auth_foundation/bottom_tab_bar.md`

## Process
1. Create `components/layout/BottomTabBar.tsx`:
   - Fixed to bottom, full width, `md:hidden`
   - 5 tab items matching sidebar nav: Overview, Silos, News, Discover, Settings
   - Each tab: icon + label (small text below icon)
   - Active tab: highlighted icon + text color
   - Uses `next/link` with `usePathname()` for active state
   - Safe area padding for devices with bottom bars (iOS)
2. Ensure BottomTabBar does not overlap content:
   - Add `pb-16 md:pb-0` to main content area in AppShell

## Outputs
- `components/layout/BottomTabBar.tsx`

## Verify
- Visible only on mobile (< 768px)
- Hidden on desktop (>= 768px)
- All 5 tabs navigate correctly
- Active tab highlighted
- No content overlap

## Handoff
→ Sprint 4 (SessionContext)
