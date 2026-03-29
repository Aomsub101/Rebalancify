/**
 * Integration tests for GET /api/news/portfolio
 *
 * Cases:
 *   1. Unauthenticated → 401
 *   2. User has no holdings → 200 { data: [], total: 0 }
 *   3. User has holdings, DB error → 500
 *   4. Tier-1 articles ranked before tier-2
 *   5. is_read + is_dismissed joined from user_article_state
 *   6. Pagination: page 2 returns correct slice
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return {
    ...actual,
    NextResponse: {
      json: (body: unknown, init?: ResponseInit) => ({
        json: async () => body,
        status: init?.status ?? 200,
      }),
    },
  }
})

const mockGetUser = vi.fn()
let mockFromImpl: (table: string) => unknown = () => ({})

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => mockFromImpl(table)),
  })),
}))

import { GET } from '../route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL('http://localhost/api/news/portfolio')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return { url: url.toString(), headers: { get: () => 'Bearer token' } } as unknown as Request
}

function makeArticle(id: string, tickers: string[], isMacro = false, metadata: unknown = null) {
  return {
    id,
    external_id: `ext-${id}`,
    source: 'finnhub',
    tickers,
    headline: `Headline ${id}`,
    summary: null,
    url: 'https://example.com',
    published_at: '2026-01-01T00:00:00Z',
    is_macro: isMacro,
    fetched_at: '2026-01-01T00:00:00Z',
    metadata,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/news/portfolio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Unauthorized') })
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns empty result when user has no holdings', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockFromImpl = (table) => {
      if (table === 'holdings') {
        return {
          select: () => ({ data: [], error: null }),
        }
      }
      return {}
    }
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(0)
    expect(body.total).toBe(0)
  })

  it('returns 500 on holdings DB error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockFromImpl = (table) => {
      if (table === 'holdings') {
        return { select: () => ({ data: null, error: new Error('DB error') }) }
      }
      return {}
    }
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('DB_ERROR')
  })

  it('returns tier-1 articles ranked before tier-2', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    const tier1Article = makeArticle('art-1', ['AAPL'])
    const tier2Article = makeArticle('art-2', ['GOOG'], false, { related_tickers: ['AAPL'] })
    const unrelatedArticle = makeArticle('art-3', ['TSLA'])

    mockFromImpl = (table) => {
      if (table === 'holdings') {
        return {
          select: () => ({
            data: [{ asset_id: 'a1', silos: { user_id: 'user-1' }, assets: { ticker: 'AAPL' } }],
            error: null,
          }),
        }
      }
      if (table === 'news_cache') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  data: [tier1Article, tier2Article, unrelatedArticle],
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'user_article_state') {
        return {
          select: () => ({
            in: () => ({ data: [], error: null }),
          }),
        }
      }
      return {}
    }

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()

    // Only tier-1 and tier-2 match; unrelated is excluded
    expect(body.data).toHaveLength(2)
    // Tier-1 first
    expect(body.data[0].id).toBe('art-1')
    expect(body.data[0].tier).toBe(1)
    // Tier-2 second
    expect(body.data[1].id).toBe('art-2')
    expect(body.data[1].tier).toBe(2)
  })

  it('joins is_read and is_dismissed from user_article_state', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    const article = makeArticle('art-1', ['AAPL'])

    mockFromImpl = (table) => {
      if (table === 'holdings') {
        return {
          select: () => ({
            data: [{ asset_id: 'a1', silos: { user_id: 'user-1' }, assets: { ticker: 'AAPL' } }],
            error: null,
          }),
        }
      }
      if (table === 'news_cache') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  data: [article],
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'user_article_state') {
        return {
          select: () => ({
            in: () => ({
              data: [{ article_id: 'art-1', is_read: true, is_dismissed: false }],
              error: null,
            }),
          }),
        }
      }
      return {}
    }

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.data[0].is_read).toBe(true)
    expect(body.data[0].is_dismissed).toBe(false)
  })

  it('defaults is_read and is_dismissed to false when no state row exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    const article = makeArticle('art-1', ['AAPL'])

    mockFromImpl = (table) => {
      if (table === 'holdings') {
        return {
          select: () => ({
            data: [{ asset_id: 'a1', silos: { user_id: 'user-1' }, assets: { ticker: 'AAPL' } }],
            error: null,
          }),
        }
      }
      if (table === 'news_cache') {
        return {
          select: () => ({
            eq: () => ({ order: () => ({ limit: () => ({ data: [article], error: null }) }) }),
          }),
        }
      }
      if (table === 'user_article_state') {
        return { select: () => ({ in: () => ({ data: [], error: null }) }) }
      }
      return {}
    }

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.data[0].is_read).toBe(false)
    expect(body.data[0].is_dismissed).toBe(false)
  })

  it('paginates correctly — page 2 returns remaining articles', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    // 3 tier-1 articles; request page=2&limit=2 → should return 1 item
    const articles = ['art-1', 'art-2', 'art-3'].map((id) => makeArticle(id, ['AAPL']))

    mockFromImpl = (table) => {
      if (table === 'holdings') {
        return {
          select: () => ({
            data: [{ asset_id: 'a1', silos: { user_id: 'user-1' }, assets: { ticker: 'AAPL' } }],
            error: null,
          }),
        }
      }
      if (table === 'news_cache') {
        return {
          select: () => ({
            eq: () => ({ order: () => ({ limit: () => ({ data: articles, error: null }) }) }),
          }),
        }
      }
      if (table === 'user_article_state') {
        return { select: () => ({ in: () => ({ data: [], error: null }) }) }
      }
      return {}
    }

    const res = await GET(makeRequest({ page: '2', limit: '2' }))
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe('art-3')
    expect(body.page).toBe(2)
    expect(body.total).toBe(3)
    expect(body.hasMore).toBe(false)
  })
})
