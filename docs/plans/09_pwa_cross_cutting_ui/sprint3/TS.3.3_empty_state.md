# TS.3.3 — Empty State

## Task
Create standardized EmptyState component for all list/table components.

## Target
`components/shared/EmptyState.tsx`

## Inputs
- `docs/architecture/components/09_pwa_cross_cutting_ui/07_empty_state.md`

## Process
1. Create `components/shared/EmptyState.tsx`:
   - Props: `{ icon: ReactNode, title: string, description: string, actionLabel?: string, actionHref?: string, onAction?: () => void }`
   - Display: centered icon, one-line description, optional CTA button
   - CTA button points to the action that would populate the list
2. Integrate into all list/table components:
   - Silos list (no silos) → "Create your first silo" CTA
   - Holdings table (no holdings) → "Add your first asset" CTA
   - News list (no articles) → "Refresh news" CTA
   - TopMovers (no data) → "Data unavailable" message
   - Rebalance history (no sessions) → "Run your first rebalance" CTA
3. Code review: all list components handle empty array with EmptyState

## Outputs
- `components/shared/EmptyState.tsx`
- Updated all list/table components

## Verify
- All lists show EmptyState when data is empty array
- CTA buttons navigate to correct actions

## Handoff
→ TS.3.4 (FooterDisclaimer)
