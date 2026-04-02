# TS.4.4 — Shared Utilities

## Task
Set up Sonner toaster, CSS design tokens, and the formatNumber utility.

## Target
`app/layout.tsx`, `app/globals.css`, `lib/formatNumber.ts`

## Inputs
- `docs/architecture/components/01_auth_foundation/shared_utility_components.md`
- `docs/architecture/components/02_portfolio_data_layer/09-format_number.md`

## Process
1. Mount `<Toaster position="bottom-right" richColors closeButton />` in `app/layout.tsx`
2. Define CSS variable tokens in `app/globals.css`:
   - `--sidebar-background`, `--sidebar-foreground`
   - `--card`, `--card-foreground`
   - `--primary`, `--primary-foreground`
   - `--destructive`, `--muted`, `--accent`, `--border`, `--ring`
   - Light and dark theme variants via `@media (prefers-color-scheme: dark)`
3. Create `lib/formatNumber.ts`:
   - `formatNumber(value, type)` where type = 'currency' | 'percent' | 'quantity' | 'compact'
   - Currency: 2 decimals with $ prefix (or base currency symbol)
   - Percent: 2 decimals with % suffix
   - Quantity: up to 8 decimals (crypto), 2 decimals (stocks)
   - Compact: 1.2K, 3.4M formatting
   - All components must use this — no raw `.toFixed()` calls

## Outputs
- Updated `app/layout.tsx` (Toaster)
- Updated `app/globals.css` (CSS tokens)
- `lib/formatNumber.ts`

## Tests
- Unit tests for `formatNumber` covering all format types

## Verify
- `toast('Test')` in browser console → toast appears bottom-right
- CSS tokens resolve correctly in browser DevTools
- `formatNumber` unit tests pass

## Handoff
→ Sprint 5 (deployment + testing)
