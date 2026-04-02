# TS.1.4 — RLS Policies Verification

## Task
Verify and test Row Level Security policies on all user-data tables.

## Target
All tables in `docs/architecture/02-database-schema.md`

## Inputs
- TS.1.2 outputs (all tables with RLS enabled)
- TS.1.3 outputs (auth trigger working)

## Process
1. Verify RLS enabled on each table:
   - `user_profiles` — `USING (id = auth.uid())`
   - `silos` — `USING (user_id = auth.uid())`
   - `holdings` — `USING (silo_id IN (SELECT id FROM silos WHERE user_id = auth.uid()))`
   - `target_weights` — same as holdings
   - `asset_mappings` — same as holdings
   - `rebalance_sessions` — `USING (user_id = auth.uid())`
   - `rebalance_orders` — via session ownership
   - `user_article_state` — `USING (user_id = auth.uid())`
   - `knowledge_chunks` — `USING (user_id = auth.uid())`
   - `research_sessions` — `USING (user_id = auth.uid())`
   - `notifications` — `USING (user_id = auth.uid())`
2. Verify read-only public tables:
   - `assets` — `FOR SELECT USING (TRUE)`
   - `price_cache` — `FOR SELECT USING (TRUE)`
   - `fx_rates` — `FOR SELECT USING (TRUE)`
   - `news_cache` — `FOR SELECT USING (TRUE)`
3. Write integration test: User A creates silo → User B's JWT cannot SELECT it

## Outputs
- All RLS policies verified and tested
- Integration test file for cross-user isolation

## Tests
- `tests/integration/rls_isolation.test.ts`

## Verify
- Two-user test: User A data invisible to User B
- Public data (assets, prices) visible to all authenticated users

## Handoff
→ Sprint 2 (Next.js scaffold)
