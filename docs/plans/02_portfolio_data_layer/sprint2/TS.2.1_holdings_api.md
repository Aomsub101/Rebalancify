# TS.2.1 — Holdings API

## Task
Implement GET/POST/PATCH /api/silos/:id/holdings with all derived fields.

## Target
`app/api/silos/[id]/holdings/route.ts`

## Inputs
- Sprint 1 outputs (silo + asset mapping APIs)
- `docs/architecture/components/02_portfolio_data_layer/04-holdings_api.md`
- `docs/architecture/02-database-schema.md` (holdings table)

## Process
1. **GET /api/silos/:id/holdings:**
   - Join holdings with assets and price_cache
   - Compute derived fields per holding:
     - `current_price` — from price_cache
     - `current_value` — quantity × current_price
     - `current_weight_pct` — current_value / silo_total_value × 100
     - `drift_pct` — current_weight_pct - target_weight_pct
     - `stale_days` — days since last_updated_at
   - Include silo-level aggregates: `total_value`, `cash_balance`, `weights_sum_pct`
2. **POST /api/silos/:id/holdings:**
   - For manual silos: create holding with quantity + cost_basis
   - `price` in request body is **ignored** — price comes from price_cache
   - Must have asset_mapping for this silo first
3. **PATCH /api/silos/:id/holdings/:holding_id:**
   - Update quantity and/or cost_basis for manual holdings
   - Update `last_updated_at` to NOW()

## Outputs
- `app/api/silos/[id]/holdings/route.ts` (GET, POST)
- `app/api/silos/[id]/holdings/[holding_id]/route.ts` (PATCH)

## Verify
- GET returns all derived fields correctly
- POST ignores price field, uses price_cache
- Stale_days computed correctly

## Handoff
→ TS.2.2 (Target weights)
