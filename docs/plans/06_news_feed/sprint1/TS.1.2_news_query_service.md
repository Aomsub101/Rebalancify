# TS.1.2 — News Query Service

## Task
Implement lib/newsQueryService.ts for two-tier portfolio filtering and ranking.

## Target
`lib/newsQueryService.ts`

## Inputs
- `docs/architecture/components/06_news_feed/02-news_query_service.md`

## Process
1. Create `lib/newsQueryService.ts`:
   - `splitIntoTiers(articles, userTickers)`:
     - Tier 1: article's `tickers[]` overlaps with user's holding tickers (GIN index)
     - Tier 2: article's `metadata.related_tickers` overlaps with user tickers
   - `mergeAndRankArticles(tier1, tier2)`: tier-1 first, deduped by id
   - `paginateArticles(array, page, limit)`: 1-based page slicing
2. Tier 1 uses GIN index on `news_cache.tickers` for fast array overlap
3. Tier 2 enabled by migration 19 `metadata JSONB` column

## Outputs
- `lib/newsQueryService.ts`

## Verify
- Tier 1 articles ranked higher than Tier 2
- No duplicates in merged output
- Pagination returns correct slices

## Handoff
→ TS.1.3 (news_cache migration)
