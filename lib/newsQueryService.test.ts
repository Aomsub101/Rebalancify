/**
 * lib/newsQueryService.test.ts
 * TDD tests for the news query service.
 * Written before implementation (Red phase).
 *
 * Tests cover:
 *   - splitIntoTiers: splits articles into tier-1 (tickers overlap) and tier-2 (metadata)
 *   - mergeAndRankArticles: deduplicates and ranks tier-1 before tier-2
 *   - paginateArticles: slices with total + hasMore flag
 */

import { describe, it, expect } from 'vitest'
import {
  splitIntoTiers,
  mergeAndRankArticles,
  paginateArticles,
  type CachedArticle,
  type RankedArticle,
} from './newsQueryService'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeArticle(overrides: Partial<CachedArticle> = {}): CachedArticle {
  return {
    id: crypto.randomUUID(),
    external_id: `ext-${Math.random()}`,
    source: 'finnhub',
    tickers: [],
    headline: 'Test headline',
    summary: null,
    url: 'https://example.com',
    published_at: '2026-01-01T00:00:00Z',
    is_macro: false,
    fetched_at: '2026-01-01T00:00:00Z',
    metadata: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// splitIntoTiers
// ---------------------------------------------------------------------------

describe('splitIntoTiers', () => {
  it('returns empty tier1 and tier2 when no articles', () => {
    const { tier1, tier2 } = splitIntoTiers([], ['AAPL'])
    expect(tier1).toHaveLength(0)
    expect(tier2).toHaveLength(0)
  })

  it('returns empty tier1 and tier2 when no user tickers', () => {
    const article = makeArticle({ tickers: ['AAPL'] })
    const { tier1, tier2 } = splitIntoTiers([article], [])
    expect(tier1).toHaveLength(0)
    expect(tier2).toHaveLength(0)
  })

  it('puts article in tier1 when tickers overlap user tickers', () => {
    const article = makeArticle({ tickers: ['AAPL', 'MSFT'] })
    const { tier1, tier2 } = splitIntoTiers([article], ['AAPL'])
    expect(tier1).toHaveLength(1)
    expect(tier1[0].id).toBe(article.id)
    expect(tier2).toHaveLength(0)
  })

  it('puts article in tier2 when metadata.related_tickers overlap but tickers do not', () => {
    const article = makeArticle({
      tickers: ['GOOG'],
      metadata: { related_tickers: ['AAPL', 'MSFT'] },
    })
    const { tier1, tier2 } = splitIntoTiers([article], ['AAPL'])
    expect(tier1).toHaveLength(0)
    expect(tier2).toHaveLength(1)
    expect(tier2[0].id).toBe(article.id)
  })

  it('does not put article in tier2 when metadata is null', () => {
    const article = makeArticle({ tickers: ['GOOG'], metadata: null })
    const { tier1, tier2 } = splitIntoTiers([article], ['AAPL'])
    expect(tier1).toHaveLength(0)
    expect(tier2).toHaveLength(0)
  })

  it('does not put article in tier2 when metadata.related_tickers is missing', () => {
    const article = makeArticle({ tickers: ['GOOG'], metadata: { sector: 'Technology' } })
    const { tier1, tier2 } = splitIntoTiers([article], ['AAPL'])
    expect(tier1).toHaveLength(0)
    expect(tier2).toHaveLength(0)
  })

  it('does not put article in tier2 when metadata.related_tickers is empty', () => {
    const article = makeArticle({ tickers: ['GOOG'], metadata: { related_tickers: [] } })
    const { tier1, tier2 } = splitIntoTiers([article], ['AAPL'])
    expect(tier1).toHaveLength(0)
    expect(tier2).toHaveLength(0)
  })

  it('does not double-count: article matching both tickers and metadata goes to tier1 only', () => {
    const article = makeArticle({
      tickers: ['AAPL'],
      metadata: { related_tickers: ['AAPL'] },
    })
    const { tier1, tier2 } = splitIntoTiers([article], ['AAPL'])
    expect(tier1).toHaveLength(1)
    expect(tier2).toHaveLength(0)
  })

  it('correctly splits a mixed array of articles', () => {
    const t1 = makeArticle({ tickers: ['AAPL'] })
    const t2 = makeArticle({ tickers: ['GOOG'], metadata: { related_tickers: ['AAPL'] } })
    const unrelated = makeArticle({ tickers: ['GOOG'] })
    const { tier1, tier2 } = splitIntoTiers([t1, t2, unrelated], ['AAPL'])
    expect(tier1).toHaveLength(1)
    expect(tier1[0].id).toBe(t1.id)
    expect(tier2).toHaveLength(1)
    expect(tier2[0].id).toBe(t2.id)
  })

  it('tier1 matches multiple user tickers', () => {
    const article = makeArticle({ tickers: ['AAPL', 'MSFT', 'GOOG'] })
    const { tier1 } = splitIntoTiers([article], ['MSFT', 'TSLA'])
    expect(tier1).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// mergeAndRankArticles
// ---------------------------------------------------------------------------

describe('mergeAndRankArticles', () => {
  it('returns empty array when both tiers are empty', () => {
    expect(mergeAndRankArticles([], [])).toHaveLength(0)
  })

  it('returns tier1 articles when tier2 is empty', () => {
    const a = makeArticle()
    const result = mergeAndRankArticles([a], [])
    expect(result).toHaveLength(1)
    expect(result[0].tier).toBe(1)
  })

  it('returns tier2 articles when tier1 is empty', () => {
    const a = makeArticle()
    const result = mergeAndRankArticles([], [a])
    expect(result).toHaveLength(1)
    expect(result[0].tier).toBe(2)
  })

  it('places all tier1 articles before all tier2 articles', () => {
    const t1a = makeArticle()
    const t1b = makeArticle()
    const t2a = makeArticle()
    const result = mergeAndRankArticles([t1a, t1b], [t2a])
    expect(result[0].tier).toBe(1)
    expect(result[1].tier).toBe(1)
    expect(result[2].tier).toBe(2)
  })

  it('deduplicates: article in both tiers appears once as tier1', () => {
    const shared = makeArticle()
    const result = mergeAndRankArticles([shared], [shared])
    expect(result).toHaveLength(1)
    expect(result[0].tier).toBe(1)
  })

  it('deduplicates by id only — same article passed twice in tier1', () => {
    const a = makeArticle()
    const result = mergeAndRankArticles([a, a], [])
    expect(result).toHaveLength(1)
  })

  it('annotates each article with its tier', () => {
    const t1 = makeArticle()
    const t2 = makeArticle()
    const result: RankedArticle[] = mergeAndRankArticles([t1], [t2])
    const ranks = result.map((r) => r.tier)
    expect(ranks).toContain(1)
    expect(ranks).toContain(2)
  })
})

// ---------------------------------------------------------------------------
// paginateArticles
// ---------------------------------------------------------------------------

describe('paginateArticles', () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ id: String(i) }))

  it('returns first page items', () => {
    const { items: page } = paginateArticles(items, 1, 10)
    expect(page).toHaveLength(10)
    expect(page[0].id).toBe('0')
  })

  it('returns correct second page', () => {
    const { items: page } = paginateArticles(items, 2, 10)
    expect(page).toHaveLength(10)
    expect(page[0].id).toBe('10')
  })

  it('returns partial last page', () => {
    const { items: page } = paginateArticles(items, 3, 10)
    expect(page).toHaveLength(5)
  })

  it('hasMore is true when more pages exist', () => {
    const { hasMore } = paginateArticles(items, 1, 10)
    expect(hasMore).toBe(true)
  })

  it('hasMore is false on last page', () => {
    const { hasMore } = paginateArticles(items, 3, 10)
    expect(hasMore).toBe(false)
  })

  it('returns total count regardless of page', () => {
    const { total } = paginateArticles(items, 2, 10)
    expect(total).toBe(25)
  })

  it('returns empty items for empty array', () => {
    const { items: page, total, hasMore } = paginateArticles([], 1, 20)
    expect(page).toHaveLength(0)
    expect(total).toBe(0)
    expect(hasMore).toBe(false)
  })

  it('returns all items when limit exceeds total', () => {
    const small = [{ id: '1' }, { id: '2' }]
    const { items: page, hasMore } = paginateArticles(small, 1, 20)
    expect(page).toHaveLength(2)
    expect(hasMore).toBe(false)
  })

  it('page beyond last returns empty items', () => {
    const { items: page, hasMore } = paginateArticles(items, 10, 10)
    expect(page).toHaveLength(0)
    expect(hasMore).toBe(false)
  })
})
