# TS.1.1 — PWA Configuration

## Task
Configure next-pwa, create manifest.json, and add PWA icons.

## Target
`next.config.mjs`, `public/manifest.json`, `public/icons/`

## Inputs
- `docs/architecture/components/09_pwa_cross_cutting_ui/01_pwa_configuration.md`

## Process
1. Install `next-pwa` and configure in `next.config.mjs`:
   - Disabled in development (`disable: process.env.NODE_ENV === 'development'`)
   - Enabled in production builds
2. Create `public/manifest.json`:
   - name: "Rebalancify", short_name: "Rebalancify"
   - icons: 192x192 + 512x512 PNG
   - theme_color: "#1E3A5F", background_color: "#F8F9FA"
   - display: "standalone", start_url: "/overview"
3. Add `<link rel="manifest" href="/manifest.json">` to root layout
4. Create PWA icons in `public/icons/`: 192.png, 512.png

## Outputs
- Updated `next.config.mjs`
- `public/manifest.json`
- `public/icons/192.png`, `public/icons/512.png`

## Verify
- Chrome DevTools → Application → Manifest → valid manifest
- "Install" button appears in Chrome address bar
- Icons display correctly on home screen

## Handoff
→ TS.1.2 (Service worker)
