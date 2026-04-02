# TS.2.3 — Rebalance History

## Task
Implement GET endpoints for per-silo and global rebalance history.

## Target
`app/api/silos/[id]/rebalance/history/route.ts`, `app/api/rebalance/history/route.ts`

## Inputs
- `docs/architecture/components/03_rebalancing_engine/05-rebalance_history.md`

## Process
1. **GET /api/silos/:id/rebalance/history:**
   - Return all `rebalance_sessions` for the silo, ordered by `created_at DESC`
   - Include nested `rebalance_orders` for each session
   - RLS ensures only owner's sessions visible
2. **GET /api/rebalance/history:**
   - Return all sessions across all silos for the authenticated user
   - Include silo name in response for context
   - Paginated: `?page=1&limit=20`
3. Each session includes: mode, status, created_at, snapshot_before summary, order count

## Outputs
- `app/api/silos/[id]/rebalance/history/route.ts`
- `app/api/rebalance/history/route.ts`

## Verify
- Per-silo history shows only that silo's sessions
- Global history shows all user sessions
- RLS: cross-user isolation
- Pagination works correctly

## Handoff
→ Sprint 3 (Order execution)
