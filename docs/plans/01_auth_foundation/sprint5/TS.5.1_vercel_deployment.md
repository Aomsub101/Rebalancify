# TS.5.1 — Vercel Deployment

## Task
Configure Vercel project with environment variables and preview URL deployments.

## Target
Vercel project settings, `vercel.json`

## Inputs
- TS.2.1 outputs (Next.js project)
- Supabase credentials from TS.1.1

## Process
1. Create Vercel project linked to the Git repository
2. Set environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ENCRYPTION_KEY` (64-char hex, 32 bytes — for Component 03)
   - `CRON_SECRET` (for drift digest cron endpoint)
3. Configure `vercel.json`:
   - Cron jobs (for later phases): `drift-digest` at 08:00 UTC
   - Framework preset: Next.js
4. Verify automatic deployments on push to `main`
5. Verify preview URLs on PR branches

## Outputs
- Vercel project configured
- `vercel.json` with cron schedule
- Production URL serving the app

## Verify
- Push to `main` → automatic deployment succeeds
- PR branch → preview URL generated
- Environment variables accessible in API routes

## Handoff
→ TS.5.2 (test infrastructure)
