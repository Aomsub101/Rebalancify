/**
 * Integration tests for GET /api/news/macro
 *
 * Cases:
 *   1. Unauthenticated → 401
 *   2. No macro articles → 200 { data: [], total: 0 }
 *   3. Returns only is_macro=true articles
 *   4. is_read + is_dismissed joined from user_article_state
 *   5. Pagination works correctly
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
  const url = new URL('http://localhost/api/news/macro')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return { url: url.toString(), headers: { get: () => 'Bearer token' } } as unknown as Request
}

function makeMacroArticle(id: string) {
  return {
    id,
    external_id: `ext-${id}`,
    source: 'finnhub',
    tickers: [],
    headline: `Macro headline ${id}`,
    summary: null,
    url: 'https://example.com',
    published_at: '2026-01-01T00:00:00Z',
    is_macro: true,
    fetched_at: '2026-01-01T00:00:00Z',
    metadata: null,
  }
}

function buildNewsChain(articles: unknown[]) {
  return {
    select: () => ({
      eq: () => ({
        order: () => ({
          limit: () => ({ data: articles, error: null }),
        }),
      }),
    }),
  }
}

function buildStateChain(rows: unknown[]) {
  return {
    select: () => ({
      in: () => ({ data: rows, error: null }),
    }),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/news/macro', () => {
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

  it('returns empty result when no macro articles exist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockFromImpl = (table) => {
      if (table === 'news_cache') return buildNewsChain([])
      return {}
    }
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(0)
    expect(body.total).toBe(0)
    expect(body.hasMore).toBe(false)
  })

  it('returns 500 on news_cache DB error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockFromImpl = (table) => {
      if (table === 'news_cache') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({ data: null, error: new Error('DB error') }),
              }),
            }),
          }),
        }
      }
      return {}
    }
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('DB_ERROR')
  })

  it('returns macro articles with is_read and is_dismissed', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    const article = makeMacroArticle('mac-1')

    mockFromImpl = (table) => {
      if (table === 'news_cache') return buildNewsChain([article])
      if (table === 'user_article_state') {
        return buildStateChain([
          { article_id: 'mac-1', is_read: true, is_dismissed: true },
        ])
      }
      return {}
    }

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe('mac-1')
    expect(body.data[0].is_read).toBe(true)
    expect(body.data[0].is_dismissed).toBe(true)
  })

  it('defaults is_read and is_dismissed to false when no state row', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    const article = makeMacroArticle('mac-1')

    mockFromImpl = (table) => {
      if (table === 'news_cache') return buildNewsChain([article])
      if (table === 'user_article_state') return buildStateChain([])
      return {}
    }

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.data[0].is_read).toBe(false)
    expect(body.data[0].is_dismissed).toBe(false)
  })

  it('paginates correctly', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    const articles = ['m1', 'm2', 'm3', 'm4', 'm5'].map(makeMacroArticle)

    mockFromImpl = (table) => {
      if (table === 'news_cache') return buildNewsChain(articles)
      if (table === 'user_article_state') return buildStateChain([])
      return {}
    }

    const res = await GET(makeRequest({ page: '2', limit: '2' }))
    const body = await res.json()
    expect(body.data).toHaveLength(2)
    expect(body.data[0].id).toBe('m3')
    expect(body.data[1].id).toBe('m4')
    expect(body.total).toBe(5)
    expect(body.hasMore).toBe(true)
    expect(body.page).toBe(2)
  })
})
