# STORY-020 — Daily Drift Digest Alert

## AGENT CONTEXT

**What this file is:** A user story specification for the daily drift digest — pg_cron job, notifications table inserts, and Resend email delivery with graceful fallback. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F5-R1 (drift alert triggers), F5-R2 (notification channel routing), F5-R3 (email template)
**Connected to:** `docs/architecture/02-database-schema.md` (notifications table, user_profiles drift_notif_channel), `docs/architecture/03-api-contract.md` (notifications count in profile response), `docs/architecture/04-component-tree.md` (NotificationBell)
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-05 — Drift & Overview
**Phase:** 4
**Estimate:** 2 developer-days
**Status:** 🔲 Not started
**Depends on:** STORY-017 (drift calc), Resend SDK configured
**Blocks:** Nothing

---

## User Story

As a user, I receive a daily notification when any asset's drift exceeds my configured threshold — delivered as an in-app alert, email, or both.

---

## Acceptance Criteria

1. A `pg_cron` job runs daily at 08:00 UTC. For each user with `drift_notif_channel ≠ null`: check all silos for drift-breached assets.
2. If breached assets found and `drift_notif_channel` includes `'app'`: insert a row into the `notifications` table (fully specified in `docs/architecture/02-database-schema.md`). Columns to populate: `user_id`, `type = 'drift_breach'`, `message` (e.g., 'AAPL is 6.2% above target'), `silo_id`, `asset_ticker`. The `NotificationBell` badge in TopBar shows the count of unread notifications.
3. If `drift_notif_channel` includes `'email'`: send a digest email via Resend using the `drift_digest` template. Template shows: silo name, ticker, current drift %, threshold.
4. If Resend is unavailable: skip email, log failure to server logs only. In-app notification still fires.
5. Frequency is daily maximum — not real-time.
6. Email contains: "This is not financial advice" disclaimer.

---

## Tasks

**Part 1 — In-app notifications (pg_cron SQL only):**
- [ ] Write migration 17 SQL (`17_pg_cron_drift_digest.sql`): pg_cron job runs daily at 08:00 UTC, queries `silos` + `holdings` + `target_weights` + `price_cache` for drift breaches, INSERTs rows into `notifications` table for users with `drift_notif_channel IN ('app', 'both')`. This SQL job does NOT call Resend — it only writes to the DB.

**Part 2 — Email delivery (Vercel Cron Job):**
- [ ] Create `vercel.json` at the project root with the cron schedule:
  ```json
  {
    "crons": [
      { "path": "/api/cron/drift-digest", "schedule": "0 8 * * *" }
    ]
  }
  ```
- [ ] Add `CRON_SECRET` to `.env.local`, `.env.example`, and Vercel environment variables. This is a random string used to authenticate the cron request.
- [ ] Write `app/api/cron/drift-digest/route.ts`: validates `Authorization: Bearer $CRON_SECRET` header, queries for users with `drift_notif_channel IN ('email', 'both')` whose assets have drift breaches, sends one email per user via Resend SDK using the `drift_digest` template.
- [ ] Write the `drift_digest` Resend email template (inline React Email or plain HTML): shows silo name, ticker, drift %, threshold, and "This is not financial advice" disclaimer.
- [ ] Add `CRON_SECRET` to the environment variable table in `docs/development/01-dev-environment.md`.

**Testing:**
- [ ] Manually invoke the Vercel Cron endpoint: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/drift-digest` → verify email received
- [ ] Simulate Resend failure (mock 500): verify in-app notification still fires, no crash
- [ ] Verify the pg_cron SQL-only path: manually run migration 17 SQL against the local DB → verify `notifications` row inserted

---

## Definition of Done

- [ ] All 6 acceptance criteria verified
- [ ] Resend failure test: simulate Resend 500 → in-app notification still fires, no crash, no unhandled rejection
- [ ] Email includes "This is not financial advice" disclaimer
- [ ] `CRON_SECRET` validation tested: call `/api/cron/drift-digest` without the header → HTTP 401 returned
- [ ] `vercel.json` committed to the repository with the correct cron schedule
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] `bd close <task-id> "STORY-020 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file

---

## Notes

**Architecture decision (ADR-013):** Email delivery uses a Vercel Cron Job, NOT pg_cron. pg_cron (migration 17) handles in-app notifications (DB writes only). The Vercel Cron Job at `app/api/cron/drift-digest/route.ts` handles Resend email dispatch. See `docs/architecture/01-tech-stack-decisions.md` ADR-013 for full rationale.

**Schwab token expiry notification:** The same Vercel Cron Job should also check `schwab_token_expires < NOW() + INTERVAL '2 days'` and insert a `'schwab_token_expiring'` notification for affected users. Add this check to the cron handler alongside the drift check.
