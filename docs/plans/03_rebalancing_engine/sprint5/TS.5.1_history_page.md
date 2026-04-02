# TS.5.1 — Rebalance History Page

## Task
Build the rebalance history page UI showing past sessions and order details.

## Target
`app/(dashboard)/silos/[silo_id]/history/page.tsx`

## Inputs
- TS.2.3 outputs (history API endpoints)
- `docs/architecture/04-component-tree.md`

## Process
1. Create `app/(dashboard)/silos/[silo_id]/history/page.tsx`:
   - Fetch `GET /api/silos/:id/rebalance/history`
   - List of session cards, ordered by date descending
   - Each card: date, mode, status badge, order count, total value
   - Expandable: click to see individual order rows
   - EmptyState when zero sessions
   - LoadingSkeleton during fetch
2. Session status badges:
   - `pending` → grey
   - `approved` → green
   - `partial` → amber
   - `cancelled` → red

## Outputs
- `app/(dashboard)/silos/[silo_id]/history/page.tsx`
- `components/rebalance/HistorySessionCard.tsx`

## Verify
- History renders in reverse chronological order
- Expandable order details work
- Status badges show correct colors

## Handoff
→ TS.5.2 (Unit tests)
