# STORY-001 — Supabase Setup & All Migrations

**Epic:** EPIC-01 — Foundation
**Phase:** 0
**Estimate:** M (3–5 days)
**Status:** 🔲 Not started
**Depends on:** Nothing — this is the first task
**Blocks:** STORY-002, STORY-003, STORY-004, and every story that touches the database
**Schema authority:** `docs/architecture/02-database-schema.md` is the only authoritative source for column definitions. `TECH_DOCS_v1_2.md` is missing the `onboarded` column and `notifications` table — ignore it for schema work.

---

## User Story

As a developer, I need a fully configured Supabase project with all database tables, RLS policies, and the auth trigger in place so that every subsequent story can build against a stable schema from day one.

---

## Migration Safety Protocol

**Read this before running any migration.**

18 migrations must run in order. Failures mid-sequence leave the schema in a partially-created state. Follow these rules:

1. **Pre-flight check — run BEFORE migration 01:**
   ```sql
   SELECT extname FROM pg_extension WHERE extname IN ('vector', 'pg_cron');
   ```
   Both `vector` AND `pg_cron` must appear. If either is missing: go to Supabase dashboard → Database → Extensions → enable the missing one. Do not proceed until both are confirmed.

2. **Run migrations one at a time** (not via bulk `supabase db push`). Paste each file into the Supabase SQL Editor individually. This isolates failures to a single file.

3. **If a migration fails:**
   - Do NOT run subsequent migrations.
   - Note the exact error message.
   - Write a compensating migration that drops only the objects the failed migration created (e.g., `DROP TABLE IF EXISTS knowledge_chunks;`), run that, fix the failed migration, then re-run it.
   - Never run `supabase db reset` against anything other than a local dev environment — it wipes all data.

4. **Migrations with external dependencies:**
   - Migration 14 (`14_knowledge_chunks.sql`) requires `vector` extension — verify in step 1.
   - Migration 17 (`17_pg_cron_drift_digest.sql`) requires `pg_cron` extension — verify in step 1.
   - Migration 17 does NOT call Resend directly — it only INSERTs into the `notifications` table (see ADR-013).

---

## Background

All 18 migration files are run in this story — including v2.0 tables (`knowledge_chunks`, `research_sessions`) and pg_cron jobs. Running them all now prevents schema migrations during active development. The v2.0 tables will simply be unused until Phase 8.

---

## Acceptance Criteria

1. Supabase project created with pgvector and pg_cron extensions enabled.
2. All 18 migrations run in dependency order (see `docs/architecture/02-database-schema.md` Migration Run Order) with zero errors.
3. All user-data tables have RLS enabled. Verified via: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';` — `rowsecurity = TRUE` for all 11 user-data tables (user_profiles, silos, asset_mappings, holdings, target_weights, rebalance_sessions, rebalance_orders, user_article_state, notifications, knowledge_chunks, research_sessions) plus read-only RLS on 4 global tables (assets, price_cache, fx_rates, news_cache).
4. Global tables (`assets`, `price_cache`, `fx_rates`, `news_cache`) have `FOR SELECT USING (TRUE)` RLS policy — read by all authenticated users, write only via service role.
5. Auth trigger `on_auth_user_created` is active. Verified by: create a test user via Supabase Auth → confirm a `user_profiles` row is auto-created with that user's UUID.
6. RLS isolation test: user A inserts a silo → user B's JWT cannot SELECT that silo (0 rows returned).
7. `knowledge_chunks` table exists with HNSW index on embedding column — even though it won't be used until Phase 8.
8. `research_sessions` table exists.
9. `supabase/migrations/` directory committed to repo with all 18 numbered SQL files.

---

## Tasks

- [ ] Create Supabase project, enable pgvector and pg_cron extensions
- [ ] Write migration 01: auth.users trigger (`handle_new_user` function + `on_auth_user_created` trigger)
- [ ] Write migration 02: user_profiles table (includes `onboarded BOOLEAN NOT NULL DEFAULT FALSE` column and `progress_banner_dismissed BOOLEAN NOT NULL DEFAULT FALSE` column)
- [ ] Write migration 03: assets table (global)
- [ ] Write migration 04: silos table + RLS
- [ ] Write migration 05: asset_mappings table + RLS
- [ ] Write migration 06: holdings table + RLS
- [ ] Write migration 07: target_weights table + constraint
- [ ] Write migration 08: price_cache table + price_cache_fresh view
- [ ] Write migration 09: fx_rates table
- [ ] Write migration 10: rebalance_sessions table (no updated_at)
- [ ] Write migration 11: rebalance_orders table
- [ ] Write migration 12: news_cache table + GIN index
- [ ] Write migration 13: user_article_state table
- [ ] Write migration 14: knowledge_chunks table + HNSW index (v2.0)
- [ ] Write migration 15: research_sessions table (v2.0)
- [ ] Write migration 16: notifications table + RLS
- [ ] Write migration 17: pg_cron drift digest job (daily 08:00 UTC — checks silos for drift breaches, inserts in-app notification rows into the `notifications` table ONLY). This job does NOT call Resend — email is sent by the Vercel Cron Job at `app/api/cron/drift-digest/route.ts`. See ADR-013 in `docs/architecture/01-tech-stack-decisions.md`.
- [ ] Write migration 18: pg_cron news purge job (daily 02:00 UTC — deletes news_cache rows older than 24 hours)
- [ ] Run all migrations in Supabase SQL editor or via CLI
- [ ] Verify RLS policies (SELECT from pg_tables)
- [ ] Verify auth trigger (test user creation)
- [ ] Run RLS isolation test (two-user scenario)

---

## Definition of Done

- [ ] All 9 acceptance criteria above are verified
- [ ] `supabase/migrations/` committed to main branch
- [ ] No `warnings` or `errors` from `supabase db push`
- [ ] Zero `rowsecurity = FALSE` for user-data tables in production
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] `bd close <task-id> "STORY-001 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
