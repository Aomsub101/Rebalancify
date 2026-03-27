# docs/development/04-deployment.md — Deployment

## AGENT CONTEXT

**What this file is:** Deployment setup and pipeline for Vercel + Supabase.
**Derived from:** PRD_v1.3.md Section 5.2, TECH_DOCS_v1.2.md (DOC-05)
**Connected to:** docs/development/01-dev-environment.md

---

## Production Deployment

### Vercel Setup

1. Connect GitHub repo to Vercel.
2. Set build command: `npm run build`
3. Set output directory: `.next`
4. Add ALL environment variables from `docs/development/01-dev-environment.md` to Vercel project settings.
5. `ENCRYPTION_KEY` in production must be a different key from development.

### Supabase Production

1. Use `rebalancify_prod` as the production Supabase project (separate from `rebalancify_dev`).
   Free plan supports exactly 2 projects: dev and prod. Do not create additional projects.
2. Migrations are applied to `rebalancify_prod` manually via the SQL Editor or Supabase CLI:
   `supabase db push --project-ref [prod-ref]`
3. Enable pgvector and pg_cron extensions on `rebalancify_prod`.
4. Preview deployments (Vercel PR previews) connect to `rebalancify_dev` — never to `rebalancify_prod`.

### Environment Variable Security

| Variable | Storage | Never Store In |
|---|---|---|
| `ENCRYPTION_KEY` | Vercel environment variables | Code, `.env.local` in CI, DB |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel environment variables | Browser bundle, logs |
| External API keys (Finnhub, FMP, etc.) | Vercel environment variables | Code, DB |
| User broker API keys | Supabase DB (encrypted) | Vercel env vars, code |

### Preview Deployments

Vercel automatically creates preview deployments for every pull request. Preview deployments connect to `rebalancify_dev`. Never connect a preview deployment to `rebalancify_prod`. This is enforced by setting Preview environment variables in Vercel to use `rebalancify_dev` credentials.

---

## Monthly Operational Checklist

Run these checks on the 1st of every month after v1.0 launch:

- [ ] **Supabase total storage:** Supabase dashboard → Settings → Usage → Database size. If approaching 400 MB (80% of 500 MB free tier), plan for Supabase Pro upgrade ($25/month, 8 GB storage).
- [ ] **ExchangeRate-API quota:** Supabase logs or Vercel logs for `EXCHANGERATE_QUOTA_EXHAUSTED` entries. If quota was exhausted, consider switching to a higher-limit provider.
- [ ] **Resend email volume:** Resend dashboard → check monthly send count against the 3,000/month free tier.
- [ ] **Vercel function usage:** Vercel dashboard → check function invocation count and duration against free tier limits.
- [ ] **Schwab token expiry:** Check that no user has a `schwab_token_expires` older than 7 days without a re-auth notification having been sent.

> **Storage budget note for v2.0 (AI Research Hub):** At 10 active users each uploading 25 documents, `knowledge_chunks` alone consumes ~300 MB. At 20 users, the 500 MB limit is reached. Plan the Supabase Pro upgrade before Phase 8 (EPIC-09) ships to users. The 80% warning in the Research Hub UI monitors `knowledge_chunks` only — total project storage must be checked in the Supabase dashboard.

---

## Post-Deployment Checklist

Before each phase launch:

- [ ] All migrations have run in production Supabase
- [ ] All environment variables are set in Vercel production
- [ ] `ENCRYPTION_KEY` is set and is a different value from development
- [ ] Supabase RLS is enabled on all user-data tables (check via Supabase dashboard)
- [ ] `components.json` is committed to the repository and identical between development and production — do NOT regenerate it during deployment (`npx shadcn-ui@latest init` will overwrite it with defaults, breaking component styles)
- [ ] `pg_cron` jobs are enabled (drift digest: daily at 08:00 UTC, news cache purge: daily at 02:00 UTC)
- [ ] Lighthouse CI score ≥ 90 on production preview
- [ ] Manual security test: API key not visible in browser network requests
