# TS.5.4 — Dirty Guard

## Task
Implement beforeunload dirty guard on the weight editing interface.

## Target
`hooks/useDirtyGuard.ts`, Silo Detail Page

## Process
1. Create `hooks/useDirtyGuard.ts`:
   - Track whether form state has changed from initial (dirty flag)
   - Register `beforeunload` event when dirty
   - Show browser-native confirmation dialog on navigation attempt
   - Clean up event listener on save or unmount
2. Integrate into SiloDetailPage target weight editing:
   - When user modifies any weight → dirty = true
   - On successful save → dirty = false
   - On navigate away while dirty → browser confirmation
3. Also integrate into holdings quantity editing for manual silos

## Outputs
- `hooks/useDirtyGuard.ts`
- Updated SiloDetailPage with dirty guard

## Verify
- Edit weight → attempt navigation → beforeunload fires
- Save weights → navigate → no warning
- Close tab with unsaved changes → browser confirmation

## Handoff
→ Component 02 complete → Component 03 (Rebalancing Engine)
