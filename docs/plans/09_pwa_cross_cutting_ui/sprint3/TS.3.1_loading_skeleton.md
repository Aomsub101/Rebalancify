# TS.3.1 — Loading Skeleton

## Task
Create standardized LoadingSkeleton component and audit all useQuery callsites.

## Target
`components/shared/LoadingSkeleton.tsx`

## Inputs
- `docs/architecture/components/09_pwa_cross_cutting_ui/05_loading_skeleton.md`

## Process
1. Create `components/shared/LoadingSkeleton.tsx`:
   - Animated pulse skeleton placeholders
   - Props: `{ variant: 'card' | 'table' | 'list' | 'text' | 'page', lines?: number }`
   - Each variant matches the layout of the component it replaces during loading
2. Audit all `useQuery` callsites:
   ```bash
   grep -rn "useQuery" components/ --include="*.tsx"
   ```
   - For each: verify `isLoading` branch renders `<LoadingSkeleton />`
   - Add LoadingSkeleton where missing
3. Every data-fetching page must show skeleton during initial load — never blank

## Outputs
- `components/shared/LoadingSkeleton.tsx`
- Updated all useQuery callsites with isLoading → LoadingSkeleton

## Verify
- Audit: `grep useQuery` → each has isLoading branch
- Throttle network → skeletons visible on every page

## Handoff
→ TS.3.2 (ErrorBanner)
