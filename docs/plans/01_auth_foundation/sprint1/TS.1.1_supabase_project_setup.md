# TS.1.1 — Supabase Project Setup

## Task
Create and configure the Supabase project with required extensions.

## Target
Supabase cloud project (or local via `supabase init`)

## Inputs
- Supabase account credentials
- `docs/architecture/02-database-schema.md` (migration run order)

## Process
1. Create new Supabase project (or `supabase init` for local dev)
2. Enable `pgvector` extension: `CREATE EXTENSION IF NOT EXISTS vector`
3. Enable `pg_cron` extension: `CREATE EXTENSION IF NOT EXISTS pg_cron`
4. Configure connection pooling (transaction mode for serverless)
5. Note the project URL, anon key, and service-role key

## Outputs
- Live Supabase instance with pgvector + pg_cron enabled
- `.env.local` populated with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

## Verify
- `SELECT * FROM pg_extension WHERE extname IN ('vector', 'pg_cron')` returns 2 rows
- Connection from Next.js API route succeeds

## Handoff
→ TS.1.2 (migrations depend on extensions being available)
