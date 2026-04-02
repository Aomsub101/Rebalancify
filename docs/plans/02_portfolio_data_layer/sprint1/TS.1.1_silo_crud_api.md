# TS.1.1 — Silo CRUD API

## Task
Implement GET/POST/PATCH/DELETE /api/silos with 5-silo limit enforcement.

## Target
`app/api/silos/route.ts`, `app/api/silos/[id]/route.ts`

## Inputs
- Component 01 outputs (auth middleware, server Supabase client)
- `docs/architecture/components/02_portfolio_data_layer/01-silo_crud_api.md`
- `docs/architecture/02-database-schema.md` (silos table)

## Process
1. **GET /api/silos** — List all active silos for authenticated user
   - Query: `SELECT * FROM silos WHERE user_id = auth.uid() AND is_active = TRUE`
   - Return array with silo metadata
2. **POST /api/silos** — Create new silo
   - Check active silo count: if >= 5, return HTTP 422 `SILO_LIMIT_REACHED`
   - Validate: `name` (required), `platform_type` (enum), `base_currency` (default from profile)
   - Insert and return created silo
   - Invalidate TanStack Query `['silos']` + `['profile']` (silo count changes)
3. **PATCH /api/silos/:id** — Update silo
   - Allowed fields: `name`, `drift_threshold`, `cash_balance`
   - Verify ownership via RLS
4. **DELETE /api/silos/:id** — Soft delete
   - Set `is_active = FALSE` (preserve data)
   - Return 204

## Outputs
- `app/api/silos/route.ts` (GET, POST)
- `app/api/silos/[id]/route.ts` (PATCH, DELETE)

## Verify
- Create 5 silos → 6th returns 422
- Soft delete → `is_active = FALSE`, data preserved
- RLS: other users cannot access

## Handoff
→ TS.1.2 (Silos list page)
