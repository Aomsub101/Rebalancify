/**
 * lib/newsQueryService.ts
 * Pure helper functions for news query endpoints.
 *
 * splitIntoTiers  — separates articles into tier-1 (tickers overlap) and
 *                   tier-2 (metadata.related_tickers overlap, not in tier-1)
 * mergeAndRankArticles — combines tiers, deduplicates by id, tier-1 first
 * paginateArticles — slices an array for a given page + limit
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CachedArticle {
  id: string
  external_id: string
  source: string
  tickers: string[]
  headline: string
  summary: string | null
  url: string
  published_at: string | null
  is_macro: boolean
  fetched_at: string
  metadata: Record<string, unknown> | null
}

export interface RankedArticle extends CachedArticle {
  tier: 1 | 2
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  hasMore: boolean
}

// ---------------------------------------------------------------------------
// splitIntoTiers
// ---------------------------------------------------------------------------

/**
 * Splits articles into two tiers based on user tickers:
 *
 * Tier 1 — article.tickers has at least one element in common with userTickers
 *           (uses the GIN-indexed tickers column at the DB level; this function
 *           operates on the already-fetched result set for further splitting)
 *
 * Tier 2 — article is NOT in tier-1 AND article.metadata.related_tickers has
 *           at least one element in common with userTickers
 *
 * Articles that match neither tier are excluded from both arrays.
 * An article that matches tier-1 is never placed in tier-2.
 */
export function splitIntoTiers(
  articles: CachedArticle[],
  userTickers: string[]
): { tier1: CachedArticle[]; tier2: CachedArticle[] } {
  if (userTickers.length === 0) {
    return { tier1: [], tier2: [] }
  }

  const userTickerSet = new Set(userTickers)
  const tier1: CachedArticle[] = []
  const tier1Ids = new Set<string>()
  const tier2: CachedArticle[] = []

  for (const article of articles) {
    // Tier-1: any ticker in the article's tickers array is in userTickers
    if (article.tickers.some((t) => userTickerSet.has(t))) {
      tier1.push(article)
      tier1Ids.add(article.id)
      continue
    }

    // Tier-2: article has metadata.related_tickers that overlaps userTickers
    const relatedTickers = article.metadata?.related_tickers
    if (
      Array.isArray(relatedTickers) &&
      relatedTickers.length > 0 &&
      (relatedTickers as unknown[]).some(
        (t) => typeof t === 'string' && userTickerSet.has(t)
      )
    ) {
      tier2.push(article)
    }
  }

  return { tier1, tier2 }
}

// ---------------------------------------------------------------------------
// mergeAndRankArticles
// ---------------------------------------------------------------------------

/**
 * Merges tier-1 and tier-2 article arrays into a single ranked list.
 *
 * - Tier-1 articles appear first (ranked higher relevance).
 * - Tier-2 articles follow.
 * - Deduplication by id: if an article appears in both tiers it is kept
 *   once as tier-1 (first seen wins; tier-1 is processed first).
 * - Each article is annotated with { tier: 1 | 2 }.
 */
export function mergeAndRankArticles(
  tier1: CachedArticle[],
  tier2: CachedArticle[]
): RankedArticle[] {
  const seen = new Set<string>()
  const result: RankedArticle[] = []

  for (const article of tier1) {
    if (!seen.has(article.id)) {
      seen.add(article.id)
      result.push({ ...article, tier: 1 })
    }
  }

  for (const article of tier2) {
    if (!seen.has(article.id)) {
      seen.add(article.id)
      result.push({ ...article, tier: 2 })
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// paginateArticles
// ---------------------------------------------------------------------------

/**
 * Returns a paginated slice of any array.
 *
 * page    — 1-based page number
 * limit   — items per page
 * total   — full array length (before slicing)
 * hasMore — true if there are items beyond the current page
 */
export function paginateArticles<T>(
  articles: T[],
  page: number,
  limit: number
): PaginatedResult<T> {
  const total = articles.length
  const offset = (page - 1) * limit
  const items = articles.slice(offset, offset + limit)
  const hasMore = offset + limit < total
  return { items, total, hasMore }
}
