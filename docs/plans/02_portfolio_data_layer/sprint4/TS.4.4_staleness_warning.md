# TS.4.4 — Staleness Warning

## Task
Implement StalenessTag on holdings older than 7 days for manual silos.

## Target
`components/shared/StalenessTag.tsx`

## Inputs
- TS.2.1 outputs (holdings API returns stale_days)
- `docs/architecture/04-component-tree.md` (Shared Components)

## Process
1. Create `components/shared/StalenessTag.tsx`:
   - Props: `{ stale_days: number }`
   - Rendered when `stale_days > 7` on manual silo holdings
   - Display: "> X days old" in amber text
   - Small badge, inline with the HoldingRow
2. Add StalenessTag to HoldingsTable HoldingRow
3. Only shown for manual silos (API silos update on sync)

## Outputs
- `components/shared/StalenessTag.tsx`
- Updated HoldingsTable to include StalenessTag

## Verify
- Manual holding > 7 days shows tag
- Manual holding <= 7 days: no tag
- API silo holdings: no tag (synced regularly)

## Handoff
→ Sprint 5 (Testing)
