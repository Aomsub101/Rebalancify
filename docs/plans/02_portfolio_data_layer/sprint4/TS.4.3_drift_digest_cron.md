# TS.4.3 — Drift Digest Cron

## Task
Implement pg_cron job for in-app drift alerts and Vercel Cron for email digest via Resend.

## Target
`supabase/migrations/17_pg_cron_drift_digest.sql`, `app/api/cron/drift-digest/route.ts`

## Inputs
- TS.3.1 outputs (drift calculation)
- `docs/architecture/01-tech-stack-decisions.md` (ADR-013)
- `docs/architecture/02-database-schema.md` (notifications table)

## Process
1. **pg_cron job** (migration 17): runs daily at 08:00 UTC
   - For each user: check all silos for drift breaches
   - If any asset has red drift state: INSERT into `notifications` table
   - Type: `drift_breach`, message includes silo name + asset ticker + drift_pct
   - Deduplicate: skip if identical unread notification exists from today
2. **Vercel Cron** (`app/api/cron/drift-digest/route.ts`): runs daily at 08:00 UTC
   - Validate `CRON_SECRET` header (prevent unauthorized invocation)
   - Query all users with `drift_notif_channel IN ('email', 'both')`
   - For each: check drift breaches, compose email digest
   - Send via Resend SDK: subject "Rebalancify — Drift Alert"
   - Also check Schwab token expiry < 2 days → insert `schwab_token_expiring` notification
3. Register cron in `vercel.json`:
   ```json
   { "crons": [{ "path": "/api/cron/drift-digest", "schedule": "0 8 * * *" }] }
   ```

## Outputs
- `supabase/migrations/17_pg_cron_drift_digest.sql`
- `app/api/cron/drift-digest/route.ts`
- Updated `vercel.json`

## Verify
- pg_cron creates notifications for drift-breached users
- Vercel Cron sends email via Resend
- CRON_SECRET validation blocks unauthorized calls
- NotificationBell badge count updates

## Handoff
→ TS.4.4 (Staleness warning)
