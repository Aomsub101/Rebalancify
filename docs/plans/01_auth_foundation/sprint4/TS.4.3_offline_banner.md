# TS.4.3 — Offline Banner

## Task
Create OfflineBanner component shown when the browser is offline.

## Target
`components/shared/OfflineBanner.tsx`

## Inputs
- `docs/architecture/components/01_auth_foundation/offline_banner.md`

## Process
1. Create `components/shared/OfflineBanner.tsx`:
   - Listen to `navigator.onLine` + `online`/`offline` window events
   - When offline: show amber banner at top of content area
   - Text: "Offline — showing cached data"
   - When online: hide banner
   - Smooth transition (fade in/out)
2. Mount in AppShell layout (TS.3.1) between TopBar and main content

## Outputs
- `components/shared/OfflineBanner.tsx`

## Verify
- Toggle DevTools Network offline → banner appears
- Restore network → banner disappears
- Banner does not interfere with content layout

## Handoff
→ TS.4.4 (shared utilities)
