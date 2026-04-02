# TS.3.2 — Error Banner

## Task
Create standardized ErrorBanner component and audit all useQuery callsites.

## Target
`components/shared/ErrorBanner.tsx`

## Inputs
- `docs/architecture/components/09_pwa_cross_cutting_ui/06_error_banner.md`

## Process
1. Create `components/shared/ErrorBanner.tsx`:
   - Props: `{ error: { code?: string, message: string }, onRetry?: () => void }`
   - Display: error code (if available), error message, retry button
   - Retry button re-runs the TanStack Query (calls `refetch()`)
   - Red/destructive styling, visible but not blocking entire page
2. Audit all `useQuery` callsites:
   - For each: verify `isError` branch renders `<ErrorBanner />`
   - Pass `error` and `refetch` as retry handler
3. Every API-dependent component must handle errors — never crash

## Outputs
- `components/shared/ErrorBanner.tsx`
- Updated all useQuery callsites with isError → ErrorBanner

## Verify
- Audit: `grep useQuery` → each has isError branch
- Mock API failure → ErrorBanner visible with retry

## Handoff
→ TS.3.3 (EmptyState)
