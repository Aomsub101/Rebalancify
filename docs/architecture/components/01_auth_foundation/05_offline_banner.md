# Sub-Component: Offline Banner

## 1. The Goal

Alert the user when their browser has lost internet connectivity, displaying the banner prominently at the top of the page content so they know any data they see may be stale and actions may fail.

---

## 2. The Problem It Solves

Self-directed investors checking portfolio values need to know immediately if the data they're looking at is potentially outdated. Without an explicit offline indicator, a user might make allocation decisions based on stale cached prices. The OfflineBanner closes this information gap.

---

## 3. The Proposed Solution / Underlying Concept

### Visibility Condition

```typescript
// Mounted first (to avoid SSR hydration mismatch), then checks online status
const [mounted, setMounted] = useState(false)
const { isOnline, cachedAt } = useOnlineStatus()

// Render only when: mounted AND isOnline === false
if (!mounted || isOnline) return null
```

### `useOnlineStatus` Hook

The banner consumes a custom hook `useOnlineStatus` (from `hooks/useOnlineStatus.ts`) that tracks `navigator.onLine` and, when the browser comes back online, records the timestamp of when the connection was restored (`cachedAt`). This timestamp is displayed in the banner to tell the user the age of the data they're seeing.

### Visual Design

```
[WifiOff icon]  You're offline — data may be stale
                Offline — showing data from {relativeTime}
```

- Background: `bg-warning-bg` (amber-tinted)
- Text: `text-warning`
- Icon: `WifiOff` from Lucide React
- Relative time formatted using `formatRelativeTime()` from `lib/formatRelativeTime.ts`

### Non-Colour Signal (CLAUDE.md Rule 13)

Both the icon (`WifiOff`) and the text label ("offline") convey the same information through different channels — a colour-blind user receives the same signal.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Banner hidden when online | Page load with network connected; banner not rendered |
| Banner appears when offline | DevTools → Network tab → check "Offline" → banner appears |
| Banner disappears when restored | Uncheck "Offline"; banner disappears |
| Relative timestamp shown | Go offline; the "Offline — showing data from {relativeTime}" text appears |
| SSR-safe (no hydration mismatch) | `mounted` state prevents server-render mismatch |
| `pnpm test` | `OfflineBanner.test.tsx` (if present) passes |
