# Sub-Component: TopBar Header

## 1. The Goal

Provide the top header bar that appears on every authenticated dashboard page — showing the current page title, an optional USD conversion toggle (on the Overview page), and a notification bell with an unread count badge.

---

## 2. The Problem It Solves

Users need persistent orientation cues: which page they are on (title) and quick access to key actions (toggle display currency, view notifications). Without a shared topbar, each page would implement its own header, leading to inconsistency and duplicated logic.

---

## 3. The Proposed Solution / Underlying Concept

### Page Title Resolution

```typescript
const PAGE_TITLES = {
  '/overview':  'Overview',
  '/silos':     'Silos',
  '/news':      'News Feed',
  '/discover':  'Discover',
  '/settings':  'Settings',
}

function getPageTitle(pathname: string): string {
  for (const [prefix, title] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(prefix)) return title
  }
  return 'Rebalancify'
}
```

### USD Conversion Toggle

- **Visible only on the Overview page** (`isOverview = pathname.startsWith('/overview')`)
- Fetches FX rates from `GET /api/fx-rates` to determine if toggle should be enabled
- If FX rates are unavailable, the toggle is disabled (`opacity-40 cursor-not-allowed`) with a tooltip explaining why
- Toggle state comes from `SessionContext.showUSD`; mutations call `PATCH /api/profile` with `{ show_usd_toggle: boolean }`
- Uses `useMutation` from TanStack Query — on success, invalidates the `['profile']` query key

### Notification Bell

- Fetches `notification_count` from `GET /api/profile`
- Badge shows `9+` if count exceeds 9
- Badge colour: `bg-negative` (red) per design system tokens
- Non-colour signal: `aria-label` describes the count explicitly

### Non-Colour Signals (CLAUDE.md Rule 13)

- USD toggle: `aria-pressed` attribute reflects state; tooltip on disabled state
- Notification bell: `aria-label` with count description

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Title shows "Overview" on `/overview` | Navigate to `/overview`; h1 text is "Overview" |
| USD toggle hidden outside Overview | Navigate to `/silos`; USD button not rendered |
| USD toggle disabled when FX unavailable | Simulate FX API failure; toggle becomes greyed out with tooltip |
| Notification count badge appears | Add notifications; bell shows red badge with count |
| `aria-label` on bell | `aria-label` describes "N unread notifications" |
| `pnpm build` | Compiles without errors |
