# 11 — user_article_state Table

## The Goal

Store per-user read/dismiss state for news articles, enabling personalised filtering without duplicating article data. Each user sees their own read and dismiss state; one user's dismiss does not affect another user's view.

---

## The Problem It Solves

Without per-user state, all users would share the same read/dismiss state — what user A dismisses would disappear for user B. Or worse, dismissals would need to modify the shared article cache, potentially losing articles entirely for all users.

---

## Schema

```sql
CREATE TABLE user_article_state (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id    UUID NOT NULL REFERENCES news_cache(id) ON DELETE CASCADE,
  is_read       BOOLEAN NOT NULL DEFAULT FALSE,
  is_dismissed  BOOLEAN NOT NULL DEFAULT FALSE,
  interacted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, article_id)
);

ALTER TABLE user_article_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY article_state_owner ON user_article_state
  USING (user_id = auth.uid());
```

### Columns

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Internal identifier |
| `user_id` | UUID FK | References `auth.users(id)`, cascades on delete |
| `article_id` | UUID FK | References `news_cache(id)`, cascades on delete |
| `is_read` | BOOLEAN | Default `FALSE` |
| `is_dismissed` | BOOLEAN | Default `FALSE` |
| `interacted_at` | TIMESTAMPTZ | Last interaction time |
| `(user_id, article_id)` | UNIQUE | One row per user per article |

### Cascade Deletes

If a user deletes their account (`auth.users` row deleted), all their `user_article_state` rows are automatically removed. If an article is purged from `news_cache` (after 24h), all associated state rows are automatically removed. No orphaned rows can accumulate.

### RLS Policy

`article_state_owner USING (user_id = auth.uid())` — the `user_id = auth.uid()` condition is applied automatically by Supabase on every query using the active session. This is a row-level filter, not a column-level restriction, so the query still returns the correct columns for the authenticated user.

---

## Testing & Verification

| Check | Method |
|---|---|
| User A's state invisible to User B | Two-user test: user A dismisses → user B GET → `is_dismissed: false` |
| Cascade delete on user deletion | Manual: delete test user → `SELECT * FROM user_article_state WHERE user_id = <test>` → 0 rows |
| Cascade delete on article purge | Manual: delete 25h-old `news_cache` row → associated state row also deleted |
| UNIQUE constraint prevents duplicate rows | Manual: two PATCH for same article → second upsert updates existing row |
| `interacted_at` updated on re-interaction | Manual: read article → update again → `interacted_at` is newer |
