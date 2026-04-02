# TS.1.3 — Offline Enhancements

## Task
Disable live features when offline, show cached data with timestamp.

## Target
`components/shared/OfflineBanner.tsx` (enhance), various components

## Inputs
- `docs/architecture/components/09_pwa_cross_cutting_ui/02_offline_banner.md`

## Process
1. Enhance OfflineBanner (from Component 01):
   - Secondary label: "Offline — showing data from [relative timestamp]"
   - Timestamp from last successful API fetch (TanStack Query dataUpdatedAt)
2. Disable live feature buttons when offline:
   - Sync buttons → disabled with tooltip "Unavailable offline"
   - Refresh buttons (news, prices) → disabled
   - Rebalance Execute button → disabled
   - All disabled buttons show tooltip on hover
3. Portfolio data shows from SW cache (last-known state)
4. First offline load target: < 1 second

## Outputs
- Enhanced `components/shared/OfflineBanner.tsx`
- Offline-aware button states across components

## Verify
- DevTools offline: banner shows with timestamp
- Sync/Refresh/Rebalance buttons disabled with tooltips
- Cached data renders correctly
- First offline load < 1s

## Handoff
→ Sprint 2 (Onboarding)
