# 09 — Schwab Token Expiry Cron

## The Goal

Proactively warn users before their Schwab OAuth refresh token expires, giving them time to reconnect before their portfolio sync stops working. This runs as part of the daily drift digest Vercel Cron job.

---

## The Problem It Solves

Charles Schwab refresh tokens expire after 7 days. Without proactive warnings, users would suddenly find their Schwab silo broken, with no explanation. By inserting an in-app notification 2 days before expiry, users have a clear window to reconnect without losing sync continuity.

---

## Implementation Details

**File:** `app/api/cron/drift-digest/route.ts` (Vercel Cron handler)

**Schedule:** Daily at 08:00 UTC (configured in `vercel.json`)

### Expiry Check Logic

For every user profile with `schwab_token_expires` set:

```typescript
const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
const expiringProfiles = profiles.filter(
  (p) => p.schwab_token_expires !== null && p.schwab_token_expires < twoDaysFromNow
)
```

For each expiring profile, the cron inserts a `schwab_token_expiring` notification **only if** no unread notification of the same type already exists today (deduplication query):

```sql
SELECT id FROM notifications
  WHERE user_id = $1
    AND type = 'schwab_token_expiring'
    AND is_read = false
    AND created_at >= TODAY
  LIMIT 1
```

If no existing unread notification exists, it inserts:
```json
{
  "user_id": "<profile.id>",
  "type": "schwab_token_expiring",
  "message": "Your Charles Schwab connection expires soon. Please reconnect in Settings to maintain portfolio sync."
}
```

### Scope

The Schwab token check runs for **all users** with a Schwab connection, regardless of their `drift_notif_channel` setting. Unlike drift digest emails, this is an in-app notification only.

### Authentication

The cron route requires `Authorization: Bearer $CRON_SECRET` header. The secret is set as a Vercel environment variable and passed by Vercel's cron runner.

### Relationship to Drift Digest

The Schwab expiry check lives in the same route handler as the drift digest email sender (`GET /api/cron/drift-digest`). Both are daily Vercel Cron jobs and share the same authentication mechanism and Supabase service-role client.

---

## Testing & Verification

| Check | Method |
|---|---|
| Notification inserted 2 days before expiry | Manual: set `schwab_token_expires` to `NOW() + 1 day` → run cron → notification inserted |
| No duplicate notifications on same day | Manual: run cron twice in one day → second run inserts nothing |
| No notification for non-Schwab users | Manual: user without Schwab → run cron → no `schwab_token_expiring` inserted |
| Notification not inserted for already-expired tokens | Manual: set `schwab_token_expires = NOW() - 1 day` → run cron → `SCHWAB_TOKEN_EXPIRED` from sync, but no notification from cron |
| `CRON_SECRET` required | Manual: request without Bearer header → 401 returned |
| Notification surfaces in NotificationBell | Manual: complete OAuth → run cron → bell badge shows count |
