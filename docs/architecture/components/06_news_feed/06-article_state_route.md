# 06 — Article State Route

## The Goal

Allow users to mark news articles as `read` (clicked through) or `dismissed` (explicitly hidden). State is stored per-user per-article in `user_article_state`, and articles with `is_read: true` or `is_dismissed: true` are filtered out of the visible news feed.

---

## The Problem It Solves

Without per-user state, once a user has read an article, it would remain at the top of their feed on every subsequent visit. Users need to dismiss articles they find irrelevant without losing the article for other users who might find it valuable.

---

## Implementation Details

**File:** `app/api/news/articles/[article_id]/state/route.ts`

### PATCH — Upsert Read/Dismiss State

```typescript
const upsertPayload = {
  user_id: user.id,
  article_id,
  interacted_at: new Date().toISOString(),
}
if (typeof body.is_read === 'boolean') upsertPayload.is_read = body.is_read
if (typeof body.is_dismissed === 'boolean') upsertPayload.is_dismissed = body.is_dismissed

await supabase.from('user_article_state').upsert(upsertPayload, {
  onConflict: 'user_id,article_id'
})
```

The upsert is idempotent — calling it twice with the same state is a no-op.

### Validation

1. **Authentication required** — 401 if not authenticated
2. **Article must exist** — 404 if `article_id` not in `news_cache`
3. **Body must include `is_read` or `is_dismissed`** — 400 if neither is present

### RLS Enforcement

The `article_state_owner` policy on `user_article_state` enforces `user_id = auth.uid()`. User B's upsert query will only affect user B's rows — it cannot write to user A's state.

### Response

```json
{ "ok": true }
```

---

## Testing & Verification

| Check | Method |
|---|---|
| Mark article read → `is_read: true` returned | Manual: PATCH `{ is_read: true }` → subsequent GET has `is_read: true` |
| Mark article dismissed → filtered from feed | Manual: dismiss article → it disappears from portfolio/macro lists |
| Dismiss → then mark read → final state | Manual: dismiss then read → `is_read: true, is_dismissed: true` |
| Unknown article_id → 404 | Manual: PATCH for non-existent article → 404 |
| Missing `is_read` and `is_dismissed` → 400 | Manual: PATCH `{}` → 400 |
| User A dismiss → User B sees as unread | Two-user test: user A dismisses → user B GET shows `is_dismissed: false` |
| Idempotent | Manual: PATCH `{ is_read: true }` twice → no error |
