# Sub-Component: Offline Banner

## 1. The Goal

Display a visible banner in the AppShell when the user's device loses network connectivity, while simultaneously showing the last-cached portfolio data. Action buttons (Sync, Refresh, Rebalance) are disabled with a tooltip explaining they are unavailable offline.

---

## 2. The Problem It Solves

When a user loses connectivity momentarily, the app should not show a blank/crashed page. It should remain usable with cached data, clearly indicating that the displayed data may be stale and that write actions are unavailable until connectivity is restored.

---

## 3. The Proposed Solution / Underlying Concept

### Detection Mechanism

`OfflineBanner` uses the browser's `navigator.onLine` property as the primary detection mechanism. It also listens to `window` `online` and `offline` events to update reactively.

### Banner Content

When `navigator.onLine === false`:
```
Offline — showing data from [relative timestamp]
```

The relative timestamp shows when the last successful API response was cached (e.g., "Offline — showing data from 5 minutes ago").

### Disabled Actions

The following buttons are disabled with `title="Unavailable offline"` when offline:
- **Sync** (broker sync)
- **Refresh** (manual refresh)
- **Rebalance** (initiate rebalancing)

These are disabled via a context flag (e.g., `isOnline` from `SessionContext`) rather than per-button state.

### Re-Online Transition

When `navigator.onLine` transitions from `false` to `true`:
1. `OfflineBanner` disappears
2. User can manually trigger a refresh to fetch fresh data
3. No automatic refresh on re-connect (user controls when to sync)

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Banner appears when offline | DevTools → Network → Offline → banner visible |
| Banner disappears on re-connect | Restore network → banner gone |
| Timestamp of last cached data shown | Visual: "showing data from 5 minutes ago" |
| Sync button disabled when offline | Offline → hover Sync button → tooltip "Unavailable offline" |
| Refresh button disabled when offline | Offline → hover Refresh button → tooltip |
| Rebalance button disabled when offline | Offline → hover Rebalance button → tooltip |
| No 500/cannot-load errors shown | Visual: page shows cached data, not error state |
