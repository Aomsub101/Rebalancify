# TS.2.2 — Progress Banner

## Task
Build reactive post-onboarding progress banner with server-side dismiss.

## Target
`components/shared/ProgressBanner.tsx`

## Inputs
- `docs/architecture/components/09_pwa_cross_cutting_ui/04_progress_banner.md`

## Process
1. Create `components/shared/ProgressBanner.tsx`:
   - Shown when: `onboarded = TRUE` AND silo exists AND silo has zero holdings
   - Three steps: `● Add holdings → ○ Set target weights → ○ Run first rebalance`
   - Steps update reactively: filled circle (●) when done, empty (○) when pending
   - Step completion detected from data:
     - Holdings exist → step 1 done
     - Target weights set → step 2 done
     - Rebalance session exists → step 3 done
   - Dismiss via X button → PATCH /api/profile `{ progress_banner_dismissed: TRUE }`
   - Server-side persist (NOT localStorage) — persists across devices
   - After dismiss, never shown again
2. Mount on Overview page, conditionally

## Outputs
- `components/shared/ProgressBanner.tsx`

## Verify
- Steps fill in reactively as user completes them
- Dismiss persists across devices (server-side)
- Not shown after dismiss or completion
- Not shown if user skipped onboarding without creating silo

## Handoff
→ Sprint 3 (Shared UI components)
