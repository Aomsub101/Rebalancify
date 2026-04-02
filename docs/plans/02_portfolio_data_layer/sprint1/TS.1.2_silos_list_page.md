# TS.1.2 — Silos List Page

## Task
Build the Silos list page with SiloCardGrid and Create Silo form.

## Target
`app/(dashboard)/silos/page.tsx`, `app/(dashboard)/silos/new/page.tsx`

## Inputs
- TS.1.1 outputs (Silo CRUD API)
- `docs/architecture/04-component-tree.md` §2.3

## Process
1. Create `app/(dashboard)/silos/page.tsx`:
   - Fetch silos via `useQuery(['silos'], () => fetch('/api/silos'))`
   - Render `SiloCardGrid` with `SiloCard` for each silo
   - `PageHeader` with title + `CreateSiloButton` (disabled if count >= 5)
   - `SiloUsageInline` showing `[X/5 silos used]`
   - `EmptyState` when zero silos — CTA to create first silo
   - `LoadingSkeleton` during loading
2. Create `app/(dashboard)/silos/new/page.tsx`:
   - Form fields: name (text), platform_type (select), base_currency (select)
   - Platform options: Alpaca, BITKUB, InnovestX, Schwab, Webull, Manual
   - Default currency based on platform: THB for BITKUB, USD for others
   - Submit → POST /api/silos → redirect to `/silos/[new_id]`
3. Create `components/silos/SiloCard.tsx`:
   - SiloHeader: name + PlatformBadge + ExecutionModeTag
   - TotalValueDisplay (base currency; USD if toggle on)
   - Link to `/silos/[silo_id]`

## Outputs
- `app/(dashboard)/silos/page.tsx`
- `app/(dashboard)/silos/new/page.tsx`
- `components/silos/SiloCard.tsx`
- `components/shared/PlatformBadge.tsx`
- `components/shared/ExecutionModeTag.tsx`

## Verify
- Silos list renders correctly
- Create silo form validates and creates
- SiloCountBadge in sidebar updates

## Handoff
→ TS.1.3 (Asset search API)
