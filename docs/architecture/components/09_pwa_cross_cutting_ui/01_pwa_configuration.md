# Sub-Component: PWA Configuration

## 1. The Goal

Enable Rebalancify to be installed as a Progressive Web App on mobile and desktop devices. Users can add it to their home screen and launch it like a native app, with offline capability and full-screen chrome.

---

## 2. The Problem It Solves

Without PWA support, Rebalancify feels like a website when launched from a mobile home screen. Users lose the native-app UX expectations (standalone window, no browser address bar). PWA support closes this gap — the app becomes a first-class citizen on the user's device.

---

## 3. The Proposed Solution / Underlying Concept

### manifest.json

Located at `/public/manifest.json`:
```json
{
  "name": "Rebalancify",
  "short_name": "Rebalancify",
  "icons": [
    { "src": "/icons/192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "theme_color": "#1E3A5F",
  "background_color": "#F8F9FA",
  "display": "standalone",
  "start_url": "/overview"
}
```

### Theme Colour

`#1E3A5F` matches Rebalancify's sidebar/navy brand colour.

### Icons

Two icon sizes are required for PWA compliance:
- `/public/icons/192.png` — 192×192 pixels
- `/public/icons/512.png` — 512×512 pixels

These are generated from the app logo (typically SVG source → exported to both sizes).

### next-pwa Configuration

`next-pwa` is configured in `next.config.mjs`. It generates a service worker on `pnpm build`. In development (`NODE_ENV !== 'production'`), the service worker is disabled to avoid caching stale development builds.

### Lighthouse PWA Score

Lighthouse audit on the production URL must score ≥ 90 on the PWA category. This verifies: manifest is valid, service worker registered, icons are correct size, `start_url` is correct, `display: standalone` is set.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| manifest.json present | `ls public/manifest.json` → file exists |
| manifest.json valid | DevTools → Application → Manifest → no errors |
| Install button appears | DevTools → Application → Manifest → "Install" button visible |
| Service worker registered | DevTools → Application → Service Workers → Rebalancify SW listed |
| SW disabled in dev | DevTools → Application → Service Workers → no SW in dev mode |
| SW enabled in prod | DevTools → Application → Service Workers → SW present in prod |
| Lighthouse PWA ≥ 90 | Run Lighthouse CI on production URL |
| `pnpm build` | Build completes without errors |
