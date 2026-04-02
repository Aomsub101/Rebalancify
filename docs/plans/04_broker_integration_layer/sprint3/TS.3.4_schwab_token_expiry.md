# TS.3.4 — Schwab Token Expiry Cron

## Task
Add Schwab token expiry check to drift digest cron — notify users when token expires soon.

## Target
`app/api/cron/drift-digest/route.ts` (extend)

## Inputs
- TS.3.1 outputs (Schwab tokens with expiry)
- `docs/architecture/components/04_broker_integration_layer/09-schwab_token_expiry_cron.md`

## Process
1. Extend the Vercel Cron at `/api/cron/drift-digest`:
   - For every user with `schwab_token_expires < NOW() + 2 days`:
     - Check if unread `schwab_token_expiring` notification exists today
     - If not: INSERT notification with type `schwab_token_expiring`
     - Message: "Your Schwab connection expires in X days. Reconnect in Settings."
2. This surfaces in the NotificationBell badge count
3. Settings page shows `TokenExpiryWarning` banner when token expires < 2 days

## Outputs
- Updated `app/api/cron/drift-digest/route.ts`

## Verify
- Token expiring within 2 days → notification created
- Deduplicated: no duplicate notifications on same day
- NotificationBell count increments

## Handoff
→ Sprint 4 (Settings UI)
