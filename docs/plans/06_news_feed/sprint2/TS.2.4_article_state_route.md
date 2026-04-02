# TS.2.4 — Article State Route

## Task
Implement PATCH /api/news/articles/:id/state for per-user read/dismiss state.

## Target
`app/api/news/articles/[id]/state/route.ts`

## Inputs
- `docs/architecture/components/06_news_feed/06-article_state_route.md`

## Process
1. Create `app/api/news/articles/[id]/state/route.ts`:
   - PATCH body: `{ is_read?: boolean, is_dismissed?: boolean }`
   - Upsert into `user_article_state` with ON CONFLICT (user_id, article_id) DO UPDATE
   - Set `interacted_at = NOW()`
   - Return updated state
2. RLS ensures user can only modify their own article states
3. Frontend uses optimistic updates: UI changes immediately, rolls back on error

## Outputs
- `app/api/news/articles/[id]/state/route.ts`

## Verify
- Mark as read → `is_read = true`
- Dismiss → `is_dismissed = true`
- RLS: User B cannot modify User A's article state
- Optimistic update works in UI

## Handoff
→ Sprint 3 (News page UI)
