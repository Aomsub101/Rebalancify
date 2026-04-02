# TS.2.2 — Calculate Route

## Task
Implement POST /api/silos/:id/rebalance/calculate — create immutable session + compute orders.

## Target
`app/api/silos/[id]/rebalance/calculate/route.ts`

## Inputs
- TS.2.1 outputs (rebalance engine)
- `docs/architecture/components/03_rebalancing_engine/03-calculate_route.md`
- `docs/architecture/02-database-schema.md` (rebalance_sessions, rebalance_orders)

## Process
1. Create `app/api/silos/[id]/rebalance/calculate/route.ts`:
   - Validate JWT + silo ownership
   - Fetch current: holdings, prices, target weights, cash_balance
   - Build `snapshot_before` JSONB: `{ holdings, prices, weights, total_value }`
   - Call `rebalanceEngine()` with mode + cash settings
   - If full mode pre-flight fails: return HTTP 422 `{ balance_valid: false, balance_errors }`
   - INSERT `rebalance_sessions` row with `status: 'pending'`, `snapshot_before`
   - INSERT `rebalance_orders` rows for each computed order
   - Return session_id + orders array
2. Session is immutable after creation — no `updated_at` column
3. The only permitted updates (by execute route): `status` and `snapshot_after`

## Outputs
- `app/api/silos/[id]/rebalance/calculate/route.ts`

## Verify
- Session created with correct snapshot
- Orders match engine output
- Pre-flight failure returns 422 (not a session)
- No UPDATE on rebalance_sessions (except via execute)

## Handoff
→ TS.2.3 (Rebalance history)
