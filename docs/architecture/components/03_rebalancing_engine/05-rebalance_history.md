# Sub-Component: Rebalance History

## 1. The Goal

Provide read-only access to past rebalancing sessions — both per-silo and across all silos — so users can audit what orders were generated, which were executed, and what the portfolio looked like before each rebalance.

---

## 2. The Problem It Solves

After a rebalance executes, the user needs to look back and see: which session caused this change, what orders were generated, what the portfolio looked like before. Without history, sessions would be lost after creation. Sessions are append-only (no DELETE), so the full history is always preserved.

---

## 3. The Proposed Solution / Underlying Concept

### GET /api/silos/:id/rebalance/history

Paginated per-silo sessions, newest first:

```typescript
// Query params
const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))
const from = (page - 1) * limit
const to = from + limit - 1

// Supabase query
supabase
  .from('rebalance_sessions')
  .select('id, mode, created_at, status, snapshot_before, rebalance_orders(id, execution_status)', { count: 'exact' })
  .eq('silo_id', silo_id)
  .eq('user_id', user.id)           // extra application-layer guard
  .order('created_at', { ascending: false })
  .range(from, to)
```

### GET /api/rebalance/history

Same shape but across all user's silos (no `silo_id` filter). Sessions from multiple silos returned in a single paginated response.

### Response Shape

```typescript
{
  data: [{
    session_id: uuid,
    mode: 'partial' | 'full',
    created_at: ISO timestamp,
    status: 'pending' | 'approved' | 'partial' | 'cancelled',
    snapshot_before: EngineSnapshot | null,
    orders: [{ id: uuid, execution_status: string }]
  }],
  page: number,
  limit: number,
  total: number
}
```

### RLS Enforcement

Supabase RLS policy `rebal_sessions_owner` enforces `user_id = auth.uid()`. The explicit `eq('user_id', user.id)` in the query is an additional application-layer guard — not strictly necessary but consistent with the security testing strategy.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Cross-user isolation | User B's token → GET /api/silos/A/rebalance/history for User A's silo → 404 |
| Pagination | 25 sessions, page 2, limit 10 → exactly 10 sessions returned |
| Order newest first | Verify `created_at` ordering in multi-page response |
| `snapshot_before` present | Session from calculate step → snapshot_before field populated |
| `pnpm test` | `app/api/silos/[silo_id]/rebalance/history/__tests__/route.test.ts` passes |
