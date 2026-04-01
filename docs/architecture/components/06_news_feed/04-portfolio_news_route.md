# 04 — Portfolio News Route

## The Goal

Return news articles relevant to the user's specific holdings, filtered through two-tier matching and ranked so the most directly relevant articles appear first. Each article includes the user's personal read/dismiss state.

---

## The Problem It Solves

Users want news specifically about the assets they hold, not generic financial news. The two-tier matching ensures that articles explicitly mentioning a held ticker appear first, while broadly relevant macro articles (e.g., about the financial sector) appear second if no direct matches exist.

---

## Implementation Details

**File:** `app/api/news/portfolio/route.ts`

### Step 1 — Get User's Tickers

```typescript
const { data: holdingsData } = await supabase
  .from('holdings')
  .select('asset_id, silos!inner(user_id), assets!inner(ticker)')
// RLS: holdings filtered to auth.uid() via the join
// Returns: [{ asset_id, assets: { ticker } }, ...]
```

Extracts unique tickers from all active silos. RLS on `holdings` ensures only the authenticated user's holdings are accessible.

### Step 2 — Fetch from news_cache

```typescript
const { data: rawArticles } = await supabase
  .from('news_cache')
  .select('*')
  .eq('is_macro', false)           // portfolio news = non-macro
  .order('published_at', { ascending: false })
  .limit(500)
```

Bounded at 500 rows — enough for a week of portfolio news. `news_cache` is globally readable (`SELECT USING (TRUE)`), so the anon-key client works.

### Step 3 — Two-Tier Ranking

```typescript
const { tier1, tier2 } = splitIntoTiers(articles, userTickers)
const ranked = mergeAndRankArticles(tier1, tier2)
```

Tier 1 articles (direct ticker match) appear first. Tier 2 articles (metadata enrichment match) appear second.

### Step 4 — Per-User State Join

```typescript
const { data: stateRows } = await supabase
  .from('user_article_state')
  .select('article_id, is_read, is_dismissed')
  .in('article_id', articleIds)
// RLS: user_article_state policy restricts to auth.uid()
```

Maps `article_id → { is_read, is_dismissed }`. Articles not in this table default to `is_read: false, is_dismissed: false`.

### Response

```json
{
  "data": [
    {
      "id": "uuid",
      "headline": "...",
      "tickers": ["AAPL"],
      "source": "finnhub",
      "is_read": false,
      "is_dismissed": false,
      "tier": 1,
      ...
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 47,
  "hasMore": true
}
```

The `tier` field is included so the UI can optionally visualise relevance. `is_read` and `is_dismissed` are per-user state from `user_article_state`.

---

## Testing & Verification

| Check | Method |
|---|---|
| Tier-1 articles (direct ticker) ranked first | Manual: hold AAPL → article with `related: 'AAPL'` → tier 1 at top |
| Tier-2 articles ranked after tier-1 | Manual: article with no direct match but `metadata.related_tickers: ['AAPL']` → tier 2 |
| Articles not in user_article_state → `is_read: false` | Manual: first load → all articles have `is_read: false` |
| User A dismisses → User B still sees article | Two-user manual test |
| Empty ticker list → empty response | Manual: user with no holdings → `{ data: [], total: 0 }` |
| Pagination works | Manual: request page 2 → correct offset, `hasMore` accurate |
