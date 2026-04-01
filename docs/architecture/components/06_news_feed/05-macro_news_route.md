# 05 — Macro News Route

## The Goal

Return general macro financial news articles that are not filtered by the user's holdings. These are articles about the broader market, economy, and financial themes — relevant to all investors regardless of their portfolio composition.

---

## The Problem It Solves

Macro news (central bank decisions, macro-economic data, market-wide events) is relevant to every user. It should not be filtered by holdings tickers — a tech investor and a healthcare investor both need to know about Fed rate decisions or oil price shocks.

---

## Implementation Details

**File:** `app/api/news/macro/route.ts`

### Fetch Macro Articles

```typescript
const { data: rawArticles } = await supabase
  .from('news_cache')
  .select('*')
  .eq('is_macro', true)
  .order('published_at', { ascending: false })
  .limit(500)
```

No ticker filtering — fetches all articles where `is_macro = TRUE`.

### Per-User State Join

Same pattern as Portfolio News route — joins `user_article_state` to add `is_read` and `is_dismissed` per user.

### Pagination

```typescript
const { items, total, hasMore } = paginateArticles(withState, page, limit)
return NextResponse.json({ data: items, page, limit, total, hasMore })
```

### Structural Difference from Portfolio Route

The macro route is structurally almost identical to the portfolio route, except:
- No ticker filtering step
- Fetches `is_macro = TRUE` instead of `is_macro = FALSE`
- Does not call `splitIntoTiers` or `mergeAndRankArticles` (no ranking needed — all are equal)

---

## Testing & Verification

| Check | Method |
|---|---|
| Returns only `is_macro = TRUE` articles | Manual: `GET /api/news/macro` → all articles have `is_macro: true` in DB |
| Does not filter by user tickers | Manual: macro route called for user with no holdings → articles still returned |
| Per-user state isolated | Manual: user A marks article read → user B's response has `is_read: false` |
| Pagination | Manual: request page 2 → correct offset |
| Empty macro news → empty data array | Manual: empty `news_cache` with `is_macro = TRUE` → `{ data: [], total: 0 }` |
