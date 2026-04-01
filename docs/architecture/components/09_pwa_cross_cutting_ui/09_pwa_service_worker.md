# Sub-Component: PWA Service Worker

## 1. The Goal

Provide a service worker that caches API responses and static assets, enabling the app to function offline. The service worker uses `NetworkFirst` for dynamic API calls (preferring fresh data when available) and `CacheFirst` for static assets (never re-fetching them from the network).

---

## 2. The Problem It Solves

A service worker without a defined caching strategy either serves stale data always (CacheFirst) or defeats the offline purpose by always fetching from network (NetworkOnly). The correct hybrid strategy ensures: (a) dynamic data is as fresh as possible when online, (b) the last known data is always available when offline, and (c) static assets load instantly from cache.

---

## 3. The Proposed Solution / Underlying Concept

### Caching Strategies

| Resource Type | Strategy | Rationale |
|---|---|---|
| Static assets (JS, CSS, images, fonts) | `CacheFirst` | Never change between deploys; re-fetching wastes bandwidth |
| API GET responses (silos, holdings, news) | `NetworkFirst` | Prefer fresh data; fall back to cache on network failure |

### NetworkFirst for API Calls

For `GET /api/silos`, `GET /api/silos/:id/holdings`, `GET /api/news/portfolio`:
1. Try network first
2. If network succeeds → update cache with new response
3. If network fails → return cached response

This ensures the user always sees the last-known data, even if their connection dropped mid-session.

### CacheFirst for Static Assets

For all static assets:
1. Check cache first
2. If cached → return immediately
3. If not cached → fetch from network → store in cache → return

### Cached API Endpoints

Only safe, idempotent GET calls are cached. Mutations (POST, PATCH, DELETE) are never cached in the service worker.

### Service Worker Lifecycle

- **Registration**: on app load in `app/layout.tsx` or a dedicated SW registration module
- **Activation**: on `install` event, pre-cache critical assets
- **Fetch handling**: `fetch` event listener with strategy routing based on request URL

### Build Integration

`next-pwa` generates the service worker at `pnpm build` time. The generated file is placed in `.next/` (or equivalent output directory). In production, the SW file is served from the same origin.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Service worker registered | DevTools → Application → Service Workers → SW listed and active |
| Static assets served from cache | DevTools → Network → Size column → "(from cache)" for JS/CSS |
| API returns cached data offline | DevTools → Offline → reload → verify last data shown |
| Cache updated after successful fetch | Online → fetch → verify cache updated |
| SW activated on new deploy | Deploy new version → refresh → DevTools shows new SW |
| `pnpm build` | Build completes without errors |
