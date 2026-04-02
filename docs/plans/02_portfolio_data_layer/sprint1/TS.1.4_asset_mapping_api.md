# TS.1.4 — Asset Mapping API

## Task
Implement POST /api/silos/:id/asset-mappings to confirm a ticker for a silo.

## Target
`app/api/silos/[id]/asset-mappings/route.ts`

## Inputs
- TS.1.3 outputs (asset search provides ticker data)
- `docs/architecture/02-database-schema.md` (assets, asset_mappings tables)

## Process
1. Create `app/api/silos/[id]/asset-mappings/route.ts`:
   - **POST:** Receives `{ ticker, name, asset_type, price_source, coingecko_id?, local_label }`
   - Step 1: Upsert into `assets` table (deduplicate by `ticker + price_source`)
   - Step 2: Insert into `asset_mappings` with `(silo_id, asset_id)` unique constraint
   - If mapping already exists: return HTTP 409 `ASSET_MAPPING_EXISTS`
   - Return the created mapping with asset details
2. Verify silo ownership via RLS before insert
3. This is the permanent link between a silo and an asset — used by holdings, weights, drift

## Outputs
- `app/api/silos/[id]/asset-mappings/route.ts`

## Verify
- Create mapping → assets row upserted + mapping row created
- Duplicate mapping → HTTP 409
- RLS: cannot create mapping on another user's silo

## Handoff
→ Sprint 2 (Holdings)
