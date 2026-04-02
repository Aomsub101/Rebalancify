# TS.1.2 — Service Worker Caching Strategy

## Task
Configure service worker caching: NetworkFirst for APIs, CacheFirst for static assets.

## Target
`next.config.mjs` (next-pwa runtime caching config)

## Inputs
- `docs/architecture/components/09_pwa_cross_cutting_ui/09_pwa_service_worker.md`

## Process
1. Configure runtime caching in next-pwa:
   - **NetworkFirst** for API calls: `/api/silos`, `/api/silos/:id/holdings`, `/api/news/portfolio`
     - Network preferred, cache fallback when offline
   - **CacheFirst** for static assets: JS bundles, CSS, images, fonts
     - Cache preferred, network only for updates
2. Service worker generated on `pnpm build` (not in dev mode)
3. Cache invalidation: TanStack Query handles data freshness, SW provides offline fallback

## Outputs
- Updated `next.config.mjs` with runtime caching configuration

## Verify
- DevTools → Application → Service Workers → SW registered
- Offline mode: cached API data served from SW cache
- Static assets load instantly from cache

## Handoff
→ TS.1.3 (Offline enhancements)
