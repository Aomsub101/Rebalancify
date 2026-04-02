# TS.3.3 — TopBar Header

## Task
Build the top bar with page title, contextual actions, and notification bell.

## Target
`components/layout/TopBar.tsx`

## Inputs
- `docs/architecture/components/01_auth_foundation/topbar_header.md`

## Process
1. Create `components/layout/TopBar.tsx`:
   - Height: h-16, border-bottom, `bg-background`
   - Left: `PageTitle` — derives from current route or passed as prop
   - Center/Right: `ContextualActions` slot for page-specific buttons (USDToggle, RefreshButton)
   - Right: `NotificationBell` with unread count badge
2. Create `components/layout/NotificationBell.tsx`:
   - Bell icon (lucide-react)
   - Red badge with count when `notification_count > 0`
   - Count from `GET /api/profile` response via SessionContext
   - Clicking opens notifications dropdown (or navigates to notifications view)

## Outputs
- `components/layout/TopBar.tsx`
- `components/layout/NotificationBell.tsx`

## Verify
- Page title updates on route change
- NotificationBell shows correct count
- Badge hidden when count = 0

## Handoff
→ TS.3.4 (BottomTabBar)
