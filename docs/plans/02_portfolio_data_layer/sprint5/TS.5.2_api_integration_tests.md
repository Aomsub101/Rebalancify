# TS.5.2 — API Integration Tests

## Task
Write integration tests for CRUD operations, price cache TTL, and FX TTL.

## Target
`tests/integration/`

## Process
1. `tests/integration/silo-crud.test.ts`:
   - Create silo → verify in DB
   - Update silo name → verify
   - Soft delete → is_active = FALSE, data preserved
   - RLS: User B cannot access User A's silos
2. `tests/integration/price-cache.test.ts`:
   - First fetch → external API called, cache populated
   - Second fetch within 15 min → no external API call, fromCache = true
   - After 15 min → external API called again
3. `tests/integration/fx-rates.test.ts`:
   - First fetch → ExchangeRate-API called
   - Second fetch within 60 min → cached rates returned
   - API failure → stale rates returned (no error)
4. `tests/integration/asset-mapping.test.ts`:
   - Create mapping → assets upserted + mapping created
   - Duplicate mapping → 409 ASSET_MAPPING_EXISTS

## Outputs
- `tests/integration/silo-crud.test.ts`
- `tests/integration/price-cache.test.ts`
- `tests/integration/fx-rates.test.ts`
- `tests/integration/asset-mapping.test.ts`

## Verify
- `pnpm test` — all integration tests pass

## Handoff
→ TS.5.3 (E2E tests)
