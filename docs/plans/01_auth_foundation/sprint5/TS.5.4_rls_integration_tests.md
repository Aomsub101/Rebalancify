# TS.5.4 — RLS Integration Tests

## Task
Write integration tests verifying cross-user data isolation via RLS.

## Target
`tests/integration/rls_isolation.test.ts`

## Inputs
- TS.1.4 outputs (RLS policies active)
- TS.5.2 outputs (test infrastructure)

## Process
1. Create `tests/integration/rls_isolation.test.ts`:
   - **Setup:** Create two test users (User A, User B) via Supabase Admin API
   - **Test — Silo isolation:** User A creates a silo → query as User B → returns 0 rows
   - **Test — Holdings isolation:** User A creates holding → User B cannot SELECT it
   - **Test — Profile isolation:** User A's profile not visible to User B
   - **Test — Notifications isolation:** User A's notifications not visible to User B
   - **Test — Public data accessible:** Both users can read `assets`, `price_cache`, `fx_rates`, `news_cache`
   - **Teardown:** Delete test users
2. Use Supabase service-role client for setup/teardown
3. Use per-user anon clients (with JWT) for isolation assertions

## Outputs
- `tests/integration/rls_isolation.test.ts`

## Verify
- All isolation tests pass
- Public table access works for all authenticated users
- No cross-user data leakage

## Handoff
→ Component 01 complete → Component 02 (Portfolio Data Layer)
