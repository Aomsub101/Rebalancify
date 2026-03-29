/**
 * lib/newsService.test.ts
 * TDD tests for the news fetch service (Finnhub + FMP).
 * Written before implementation (Red phase).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  parseFinnhubArticle,
  parseFmpArticle,
  deduplicateArticles,
  fetchFinnhubNews,
  fetchFmpNews,
  type NewsArticle,
} from './newsService'

// ---------------------------------------------------------------------------
// parseFinnhubArticle
// ---------------------------------------------------------------------------

describe('parseFinnhubArticle', () => {
  it('returns a NewsArticle for valid Finnhub data', () => {
    const raw = {
      id: 5417853,
      headline: 'Apple hits record high',
      summary: 'AAPL climbed 3%',
      url: 'https://example.com/article',
      datetime: 1700000000,
      related: 'AAPL',
      category: 'company news',
    }
    const result = parseFinnhubArticle(raw)
    expect(result).not.toBeNull()
    expect(result!.externalId).toBe('finnhub-5417853')
    expect(result!.source).toBe('finnhub')
    expect(result!.headline).toBe('Apple hits record high')
    expect(result!.summary).toBe('AAPL climbed 3%')
    expect(result!.url).toBe('https://example.com/article')
    expect(result!.tickers).toContain('AAPL')
    expect(result!.isMacro).toBe(false)
  })

  it('marks general/macro category as isMacro: true', () => {
    const raw = {
      id: 1234,
      headline: 'Fed hikes rates',
      url: 'https://example.com/fed',
      datetime: 1700000000,
      related: '',
      category: 'general',
    }
    const result = parseFinnhubArticle(raw)
    expect(result!.isMacro).toBe(true)
    expect(result!.tickers).toEqual([])
  })

  it('returns null when headline is missing', () => {
    const raw = {
      id: 5417853,
      url: 'https://example.com/article',
      datetime: 1700000000,
      related: 'AAPL',
    }
    expect(parseFinnhubArticle(raw)).toBeNull()
  })

  it('returns null when url is missing', () => {
    const raw = {
      id: 5417853,
      headline: 'Apple hits record high',
      datetime: 1700000000,
      related: 'AAPL',
    }
    expect(parseFinnhubArticle(raw)).toBeNull()
  })

  it('returns null when id is missing', () => {
    const raw = {
      headline: 'Apple hits record high',
      url: 'https://example.com/article',
      datetime: 1700000000,
      related: 'AAPL',
    }
    expect(parseFinnhubArticle(raw)).toBeNull()
  })

  it('returns null for non-object input', () => {
    expect(parseFinnhubArticle(null)).toBeNull()
    expect(parseFinnhubArticle('string')).toBeNull()
    expect(parseFinnhubArticle(42)).toBeNull()
  })

  it('handles tickers from related field as comma-separated list', () => {
    const raw = {
      id: 999,
      headline: 'Tech stocks surge',
      url: 'https://example.com/tech',
      datetime: 1700000000,
      related: 'AAPL,MSFT,GOOGL',
      category: 'company news',
    }
    const result = parseFinnhubArticle(raw)
    expect(result!.tickers).toEqual(['AAPL', 'MSFT', 'GOOGL'])
  })
})

// ---------------------------------------------------------------------------
// parseFmpArticle
// ---------------------------------------------------------------------------

describe('parseFmpArticle', () => {
  it('returns a NewsArticle for valid FMP data', () => {
    const raw = {
      title: 'Microsoft acquires gaming studio',
      text: 'MSFT announced acquisition...',
      url: 'https://example.com/msft',
      publishedDate: '2024-01-15 09:30:00',
      symbol: 'MSFT',
      site: 'Reuters',
    }
    const result = parseFmpArticle(raw)
    expect(result).not.toBeNull()
    expect(result!.externalId).toBe('fmp-https://example.com/msft')
    expect(result!.source).toBe('fmp')
    expect(result!.headline).toBe('Microsoft acquires gaming studio')
    expect(result!.summary).toBe('MSFT announced acquisition...')
    expect(result!.url).toBe('https://example.com/msft')
    expect(result!.tickers).toContain('MSFT')
    expect(result!.isMacro).toBe(false)
  })

  it('marks article as macro when symbol is empty/missing', () => {
    const raw = {
      title: 'Global market outlook 2024',
      url: 'https://example.com/macro',
      publishedDate: '2024-01-15 09:30:00',
    }
    const result = parseFmpArticle(raw)
    expect(result!.isMacro).toBe(true)
    expect(result!.tickers).toEqual([])
  })

  it('returns null when title is missing', () => {
    const raw = {
      url: 'https://example.com/msft',
      publishedDate: '2024-01-15 09:30:00',
      symbol: 'MSFT',
    }
    expect(parseFmpArticle(raw)).toBeNull()
  })

  it('returns null when url is missing', () => {
    const raw = {
      title: 'Microsoft acquires gaming studio',
      publishedDate: '2024-01-15 09:30:00',
      symbol: 'MSFT',
    }
    expect(parseFmpArticle(raw)).toBeNull()
  })

  it('returns null for non-object input', () => {
    expect(parseFmpArticle(null)).toBeNull()
    expect(parseFmpArticle(undefined)).toBeNull()
    expect(parseFmpArticle([])).toBeNull()
  })

  it('handles published_date as ISO string', () => {
    const raw = {
      title: 'Some news',
      url: 'https://example.com/news',
      publishedDate: '2024-06-15 14:00:00',
      symbol: 'TSLA',
    }
    const result = parseFmpArticle(raw)
    expect(result!.publishedAt).toBeInstanceOf(Date)
  })
})

// ---------------------------------------------------------------------------
// deduplicateArticles
// ---------------------------------------------------------------------------

describe('deduplicateArticles', () => {
  const makeArticle = (externalId: string): NewsArticle => ({
    externalId,
    source: 'finnhub',
    tickers: [],
    headline: `Article ${externalId}`,
    summary: null,
    url: `https://example.com/${externalId}`,
    publishedAt: null,
    isMacro: false,
  })

  it('returns all articles when there are no duplicates', () => {
    const articles = [makeArticle('a'), makeArticle('b'), makeArticle('c')]
    expect(deduplicateArticles(articles)).toHaveLength(3)
  })

  it('removes duplicate external_ids, keeping the first occurrence', () => {
    const articles = [makeArticle('a'), makeArticle('b'), makeArticle('a')]
    const result = deduplicateArticles(articles)
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.externalId)).toEqual(['a', 'b'])
  })

  it('returns empty array for empty input', () => {
    expect(deduplicateArticles([])).toEqual([])
  })

  it('handles all duplicates gracefully', () => {
    const articles = [makeArticle('x'), makeArticle('x'), makeArticle('x')]
    expect(deduplicateArticles(articles)).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// fetchFinnhubNews
// ---------------------------------------------------------------------------

describe('fetchFinnhubNews', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('returns parsed articles for a valid Finnhub response', async () => {
    const mockData = [
      {
        id: 1,
        headline: 'Apple news',
        url: 'https://example.com/aapl',
        datetime: 1700000000,
        related: 'AAPL',
        category: 'company news',
      },
    ]
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockData,
    } as Response)

    const result = await fetchFinnhubNews('test-key', ['AAPL'], false)
    expect(result.rateLimited).toBe(false)
    expect(result.failed).toBe(false)
    expect(result.articles).toHaveLength(1)
    expect(result.articles[0].tickers).toContain('AAPL')
  })

  it('returns rateLimited: true and empty articles when Finnhub returns 429', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
    } as Response)

    const result = await fetchFinnhubNews('test-key', ['AAPL'], false)
    expect(result.rateLimited).toBe(true)
    expect(result.failed).toBe(false)
    expect(result.articles).toEqual([])
  })

  it('returns failed: true when Finnhub throws a network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const result = await fetchFinnhubNews('test-key', ['AAPL'], false)
    expect(result.rateLimited).toBe(false)
    expect(result.failed).toBe(true)
    expect(result.articles).toEqual([])
  })

  it('fetches macro news when isMacro is true', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    } as Response)

    await fetchFinnhubNews('test-key', [], true)

    const calledUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toContain('category=general')
    expect(calledUrl).not.toContain('company-news')
  })

  it('fetches company news when tickers are provided and isMacro is false', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    } as Response)

    await fetchFinnhubNews('test-key', ['MSFT'], false)

    const calledUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toContain('company-news')
  })

  it('filters out articles that fail to parse', async () => {
    const mockData = [
      { id: 1, headline: 'Valid', url: 'https://example.com/1', datetime: 1700000000, related: 'AAPL' },
      { id: 2, url: 'https://example.com/2', datetime: 1700000000 }, // missing headline → null
    ]
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockData,
    } as Response)

    const result = await fetchFinnhubNews('test-key', ['AAPL'], false)
    expect(result.articles).toHaveLength(1)
  })

  it('returns failed: true when macro fetch returns non-429 error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response)

    const result = await fetchFinnhubNews('test-key', [], true)
    expect(result.failed).toBe(true)
    expect(result.rateLimited).toBe(false)
    expect(result.articles).toEqual([])
  })

  it('skips ticker and continues when a per-ticker call returns non-429 error', async () => {
    // First call (AAPL) fails with 500, second call (MSFT) succeeds
    const msftData = [
      { id: 10, headline: 'MSFT news', url: 'https://example.com/msft', datetime: 1700000000, related: 'MSFT' },
    ]
    let callCount = 0
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) } as Response)
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => msftData } as Response)
    })

    const result = await fetchFinnhubNews('test-key', ['AAPL', 'MSFT'], false)
    expect(result.failed).toBe(false)
    expect(result.rateLimited).toBe(false)
    expect(result.articles).toHaveLength(1)
    expect(result.articles[0].tickers).toContain('MSFT')
  })
})

// ---------------------------------------------------------------------------
// fetchFmpNews
// ---------------------------------------------------------------------------

describe('fetchFmpNews', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('returns parsed articles for a valid FMP response', async () => {
    const mockData = [
      {
        title: 'Market news',
        url: 'https://example.com/market',
        publishedDate: '2024-01-15 09:30:00',
        symbol: 'AAPL',
        text: 'Details...',
      },
    ]
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockData,
    } as Response)

    const result = await fetchFmpNews('test-key', ['AAPL'])
    expect(result.failed).toBe(false)
    expect(result.articles).toHaveLength(1)
  })

  it('returns failed: true when FMP returns an error status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response)

    const result = await fetchFmpNews('test-key', ['AAPL'])
    expect(result.failed).toBe(true)
    expect(result.articles).toEqual([])
  })

  it('returns failed: true when FMP throws a network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const result = await fetchFmpNews('test-key', ['AAPL'])
    expect(result.failed).toBe(true)
    expect(result.articles).toEqual([])
  })

  it('filters out articles that fail to parse', async () => {
    const mockData = [
      { title: 'Valid', url: 'https://example.com/1', publishedDate: '2024-01-15 09:30:00', symbol: 'AAPL' },
      { url: 'https://example.com/2' }, // missing title → null
    ]
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockData,
    } as Response)

    const result = await fetchFmpNews('test-key', ['AAPL'])
    expect(result.articles).toHaveLength(1)
  })
})
