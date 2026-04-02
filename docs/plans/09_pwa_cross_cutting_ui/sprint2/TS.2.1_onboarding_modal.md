# TS.2.1 — Onboarding Modal

## Task
Build non-dismissible first-login onboarding modal with 7 platform cards.

## Target
`components/shared/OnboardingModal.tsx`

## Inputs
- `docs/architecture/components/09_pwa_cross_cutting_ui/03_onboarding_modal.md`

## Process
1. Create `components/shared/OnboardingModal.tsx`:
   - Shown exactly once: first login when `onboarded = FALSE` AND `active_silo_count = 0`
   - 7 platform cards: Alpaca, BITKUB, InnovestX, Schwab, Webull, DIME, Other (manual)
   - Select card → click "Create silo" → POST /api/silos with platform defaults
   - On create: close modal → navigate to `/silos/[new_id]` → progress banner appears
   - "Skip for now" → set `onboarded = TRUE` → land on Overview → no progress banner
   - **Non-dismissible:** No onOpenChange, clicking outside blocked, Escape blocked
   - After dismissal (skip or complete), never appears again
2. DIME platform note: PlatformBadge shows "DIME" (not "MANUAL")
3. Mount in AppShell: gated by SessionContext `onboarded` + `siloCount`

## Outputs
- `components/shared/OnboardingModal.tsx`

## Verify
- First login → modal appears
- Non-dismissible: ESC + backdrop click → stays open
- Create silo → navigates to silo detail
- Skip → modal gone, never returns
- Second login → modal not shown

## Handoff
→ TS.2.2 (Progress banner)
