# 02 — News Query Service

## The Goal

Provide the query-time filtering, ranking, and pagination logic that transforms a flat list of cached articles into a ranked, paginated news feed for a specific user. This layer operates on articles already fetched from `news_cache` and applies the two-tier portfolio filtering and per-user state joins.

---

## The Problem It Solves

Two filtering concerns are separated here:

1. **Two-tier portfolio filtering** — ranking articles by relevance to the user's holdings (direct ticker match vs. enriched metadata match)
2. **Pagination** — slicing the ranked list into pages for the UI

These cannot live in `newsService.ts` (which only calls external APIs) and should not live in the route handlers (which should remain thin orchestrators).

---

## Implementation Details

**File:** `lib/newsQueryService.ts`

### splitIntoTiers(articles, userTickers)

Splits a `CachedArticle[]` into two arrays:

**Tier 1 — Direct ticker match:**
```
article.tickers ∩ userTickers ≠ ∅
```

The GIN index on `news_cache.tickers` handles the DB-level filtering when fetching from the cache; this function provides in-memory further splitting for the two-tier ranking.

**Tier 2 — Metadata enrichment match:**
```
article NOT in tier1
AND article.metadata.related_tickers ∩ userTickers ≠ ∅
```

`metadata` is a JSONB column added in migration 19. The `related_tickers` array inside it contains broader thematic tickers not directly mentioned in the article's `tickers` field.

Articles that match neither tier are excluded from both arrays (they are general articles with no portfolio relevance and no metadata enrichment).

### mergeAndRankArticles(tier1, tier2)

Merges the two tiers into a single ranked list:
1. All tier-1 articles first (in original order)
2. All tier-2 articles next (in original order)
3. Deduplication by `id` — if an article somehow appears in both tiers, it is kept as tier-1 (first occurrence wins)

Returns `RankedArticle[]` where each item has `tier: 1 | 2` annotated.

### paginateArticles(items, page, limit)

1-based page slicing:
```typescript
const offset = (page - 1) * limit
const items = array.slice(offset, offset + limit)
const hasMore = offset + limit < total
return { items, total, hasMore }
```

---

## Testing & Verification

| Check | Method |
|---|---|
| Article in both tiers → kept as tier-1 | Unit test: same id in tier1 and tier2 → result has tier: 1 |
| Empty userTickers → both arrays empty | Unit test: `splitIntoTiers(articles, [])` → `{ tier1: [], tier2: [] }` |
| Pagination boundary | Unit test: 21 items, page=2, limit=20 → 1 item, hasMore=false |
| Metadata null → tier-2 excluded | Unit test: article with `metadata: null` → not in tier-2 |
| `hasMore = false` on last page | Unit test: 10 items, page=1, limit=20 → hasMore=false |
| `hasMore = true` when more items | Unit test: 25 items, page=1, limit=20 → hasMore=true |
