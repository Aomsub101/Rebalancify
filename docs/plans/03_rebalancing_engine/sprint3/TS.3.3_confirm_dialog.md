# TS.3.3 — ConfirmDialog

## Task
Build a non-dismissible confirmation dialog for destructive actions (rebalance execute, account delete).

## Target
`components/shared/ConfirmDialog.tsx`

## Inputs
- `docs/architecture/components/03_rebalancing_engine/10-confirm_dialog.md`
- `docs/architecture/04-component-tree.md` (Shared Components)

## Process
1. Create `components/shared/ConfirmDialog.tsx`:
   - **Non-dismissible:** No `onOpenChange` handler, clicking outside blocked, Escape key blocked
   - Props: `{ open, title, description, children (content), onConfirm, onCancel, confirmLabel, variant }`
   - Content slot for: OrderCount, PlatformName, TotalEstimatedValue
   - Two buttons:
     - CancelButton (ghost, left-aligned)
     - ConfirmButton (primary for Alpaca / secondary for manual)
   - Use shadcn/ui Dialog as base, override dismiss behavior
2. Used by:
   - RebalancePage Step 2 → Execute confirmation
   - Settings → DeleteAccountButton confirmation
   - Any future destructive action

## Outputs
- `components/shared/ConfirmDialog.tsx`

## Verify
- Click outside → dialog stays open
- Escape key → dialog stays open
- Only Cancel/Confirm buttons can close it
- Accessible: focus trap works correctly

## Handoff
→ Sprint 4 (Wizard UI)
