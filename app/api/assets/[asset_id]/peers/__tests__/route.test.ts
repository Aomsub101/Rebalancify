/**
 * Tests for GET /api/assets/:asset_id/peers
 *
 * Cases:
 *   1. Unauthenticated → 401
 *   2. Asset not found → 404
 *   3. Finnhub returns peers → 200 with ticker/name and Finnhub live prices
 *   4. Finnhub throws (network error) → static fallback, 200
 *   5. Finnhub returns HTTP error → static fallback, 200
 *   6. Finnhub quote unavailable → current_price falls back to cache or "0.00000000"
 *   7. Finnhub returns >8 peers → result capped at 8
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── next/server mock ──────────────────────────────────────────────────────────
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

// ─── Supabase mock ─────────────────────────────────────────────────────────────
const mockGetUser = vi.fn()
let mockFromImpl: (table: string) => unknown = () => ({})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => mockFromImpl(table)),
  })),
}))

import { GET } from '../route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ASSET_ID = 'asset-uuid-1'

function makeRequest(): Request & { url: string } {
  return {
    url: `http://localhost/api/assets/${ASSET_ID}/peers`,
    headers: { get: () => null },
  } as unknown as Request & { url: string }
}

function makeParams(asset_id = ASSET_ID) {
  return { params: Promise.resolve({ asset_id }) }
}

// Supabase chainable builder helpers
function chainSelect(result: unknown) {
  return {
    select: () => ({
      eq: () => ({
        single: () => result,
      }),
      in: () => result,
    }),
  }
}

function chainSelectIn(result: unknown) {
  return {
    select: () => ({
      in: () => result,
    }),
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/assets/:asset_id/peers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  // ---------------------------------------------------------------------------
  // 1. Unauthenticated
  // ---------------------------------------------------------------------------
  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Unauthorized') })
    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  // ---------------------------------------------------------------------------
  // 2. Asset not found
  // ---------------------------------------------------------------------------
  it('returns 404 when asset does not exist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockFromImpl = () => ({
      // llm_connected lookup
      select: () => ({
        eq: () => ({
          single: () => ({ data: { llm_key_enc: null }, error: null }),
        }),
      }),
    })
    // Override assets lookup specifically
    mockFromImpl = (table) => {
      if (table === 'user_profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({ data: { llm_key_enc: null }, error: null }),
            }),
          }),
        }
      }
      if (table === 'assets') {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({ data: null, error: new Error('Not found') }),
            }),
          }),
        }
      }
      return {}
    }

    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('ASSET_NOT_FOUND')
  })

  // ---------------------------------------------------------------------------
  // 3. Finnhub returns peers — enriched from DB
  // ---------------------------------------------------------------------------
  it('returns enriched peer list when Finnhub succeeds', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    mockFromImpl = (table) => {
      if (table === 'user_profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({ data: { llm_key_enc: null }, error: null }),
            }),
          }),
        }
      }
      if (table === 'assets') {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({
                data: { id: ASSET_ID, ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
                error: null,
              }),
            }),
            in: () => ({
              data: [
                { id: 'peer-1', ticker: 'MSFT', name: 'Microsoft' },
                { id: 'peer-2', ticker: 'GOOGL', name: 'Alphabet' },
              ],
              error: null,
            }),
          }),
        }
      }
      if (table === 'price_cache') {
        return chainSelectIn({ data: [], error: null })
      }
      return {}
    }

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ['MSFT', 'GOOGL', 'AAPL'], // AAPL is the queried ticker — should be excluded
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ c: 415 }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ c: 175 }) } as Response)

    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(200)
    const body = await res.json()

    // AAPL excluded from its own peer list
    expect(body.every((p: { ticker: string }) => p.ticker !== 'AAPL')).toBe(true)
    expect(body).toHaveLength(2)
    expect(body[0]).toEqual({ ticker: 'MSFT', name: 'Microsoft', current_price: '415.00000000' })
    expect(body[1]).toEqual({ ticker: 'GOOGL', name: 'Alphabet', current_price: '175.00000000' })
  })

  // ---------------------------------------------------------------------------
  // 4. Finnhub throws → static fallback
  // ---------------------------------------------------------------------------
  it('returns static fallback when Finnhub throws a network error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    // 'GOOGL' is in the Technology sector in sector_taxonomy.json
    mockFromImpl = (table) => {
      if (table === 'user_profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({ data: { llm_key_enc: null }, error: null }),
            }),
          }),
        }
      }
      if (table === 'assets') {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({
                data: { id: ASSET_ID, ticker: 'GOOGL', name: 'Alphabet', sector: 'Technology' },
                error: null,
              }),
            }),
            in: () => ({
              data: [
                { id: 'a1', ticker: 'AAPL', name: 'Apple Inc.' },
                { id: 'a2', ticker: 'MSFT', name: 'Microsoft' },
              ],
              error: null,
            }),
          }),
        }
      }
      if (table === 'price_cache') {
        return chainSelectIn({ data: [], error: null })
      }
      return {}
    }

    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network failure'))

    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(200)
    const body = await res.json()

    // Must return something from taxonomy fallback (GOOGL excluded from its own list)
    expect(body.every((p: { ticker: string }) => p.ticker !== 'GOOGL')).toBe(true)
    expect(body.length).toBeGreaterThanOrEqual(1)
  })

  // ---------------------------------------------------------------------------
  // 5. Finnhub returns HTTP error → static fallback
  // ---------------------------------------------------------------------------
  it('returns static fallback when Finnhub returns HTTP error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    mockFromImpl = (table) => {
      if (table === 'user_profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({ data: { llm_key_enc: null }, error: null }),
            }),
          }),
        }
      }
      if (table === 'assets') {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({
                data: { id: ASSET_ID, ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
                error: null,
              }),
            }),
            in: () => ({
              data: [{ id: 'a1', ticker: 'MSFT', name: 'Microsoft' }],
              error: null,
            }),
          }),
        }
      }
      if (table === 'price_cache') {
        return chainSelectIn({ data: [], error: null })
      }
      return {}
    }

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 429,
    } as Response)

    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(200)
    // fallback used — no error exposed to user
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // 6. Peer not in price_cache → current_price defaults to "0.00000000"
  // ---------------------------------------------------------------------------
  it('defaults current_price to "0.00000000" when Finnhub and price_cache both miss', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    mockFromImpl = (table) => {
      if (table === 'user_profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({ data: { llm_key_enc: null }, error: null }),
            }),
          }),
        }
      }
      if (table === 'assets') {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({
                data: { id: ASSET_ID, ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
                error: null,
              }),
            }),
            in: () => ({
              data: [{ id: 'peer-1', ticker: 'MSFT', name: 'Microsoft' }],
              error: null,
            }),
          }),
        }
      }
      if (table === 'price_cache') {
        return chainSelectIn({ data: [], error: null }) // no prices
      }
      return {}
    }

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ['MSFT'],
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response)

    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0].current_price).toBe('0.00000000')
  })

  // ---------------------------------------------------------------------------
  // 7. Finnhub returns >8 peers → capped at 8
  // ---------------------------------------------------------------------------
  it('caps peer results at 8 when Finnhub returns more', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    const manyTickers = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10']

    mockFromImpl = (table) => {
      if (table === 'user_profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({ data: { llm_key_enc: null }, error: null }),
            }),
          }),
        }
      }
      if (table === 'assets') {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({
                data: { id: ASSET_ID, ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
                error: null,
              }),
            }),
            in: () => ({
              data: manyTickers.map((t, i) => ({ id: `peer-${i}`, ticker: t, name: t })),
              error: null,
            }),
          }),
        }
      }
      if (table === 'price_cache') {
        return chainSelectIn({ data: [], error: null })
      }
      return {}
    }

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => manyTickers, // 10 tickers
    } as Response)

    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.length).toBeLessThanOrEqual(8)
  })

  it('includes ai_insight_tag when llm is connected and cached session exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    mockFromImpl = (table) => {
      if (table === 'user_profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({ data: { llm_key_enc: 'enc' }, error: null }),
            }),
          }),
        }
      }
      if (table === 'assets') {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({
                data: { id: ASSET_ID, ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
                error: null,
              }),
            }),
            in: () => ({
              data: [{ id: 'peer-1', ticker: 'MSFT', name: 'Microsoft' }],
              error: null,
            }),
          }),
        }
      }
      if (table === 'price_cache') {
        return chainSelectIn({ data: [], error: null })
      }
      if (table === 'research_sessions') {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                order: () => ({
                  data: [
                    {
                      ticker: 'MSFT',
                      created_at: '2026-03-30T00:00:00Z',
                      output: { relationship_insight: 'Competitor in enterprise software' },
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      return {}
    }

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ['MSFT'],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ c: 415 }),
      } as Response)

    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body[0]).toEqual({
      ticker: 'MSFT',
      name: 'Microsoft',
      current_price: '415.00000000',
      ai_insight_tag: 'Competitor in enterprise software',
    })
  })
})
