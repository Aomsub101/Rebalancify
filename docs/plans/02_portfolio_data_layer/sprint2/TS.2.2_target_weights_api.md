# TS.2.2 — Target Weights API

## Task
Implement PUT /api/silos/:id/target-weights with atomic replacement and sum-warning logic.

## Target
`app/api/silos/[id]/target-weights/route.ts`

## Inputs
- `docs/architecture/components/02_portfolio_data_layer/05-target_weights_api.md`
- `docs/architecture/02-database-schema.md` (target_weights table)

## Process
1. **GET /api/silos/:id/target-weights:**
   - Return all weight rows for the silo with asset details
   - Include computed: `weights_sum_pct`, `cash_target_pct` (100 - sum), `sum_warning` (bool if sum ≠ 100)
2. **PUT /api/silos/:id/target-weights:**
   - Atomic replacement: DELETE all existing weights → INSERT new weights
   - Input: array of `{ asset_id, weight_pct }` pairs
   - Validate: each `weight_pct` is 0-100 (DB constraint `weight_range`)
   - Sum does NOT need to equal 100 — remainder is cash target
   - Return: `weights_sum_pct`, `cash_target_pct`, `sum_warning`
3. Wrap in transaction for atomicity

## Outputs
- `app/api/silos/[id]/target-weights/route.ts` (GET, PUT)

## Verify
- PUT replaces all weights atomically
- Sum warning when weights ≠ 100%
- Cash target = 100 - sum
- weight_pct outside 0-100 → DB constraint error

## Handoff
→ TS.2.3 (Price service)
