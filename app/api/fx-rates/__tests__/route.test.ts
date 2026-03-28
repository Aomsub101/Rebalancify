import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

// Mock fetch for ExchangeRate-API calls
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const USER_ID = 'user-1'

const FRESH_FX_ROW = {
  currency: 'THB',
  rate_to_usd: '0.02816901',
  // fetched_at is 10 minutes ago — within 60-min TTL
  fetched_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
}

const STALE_FX_ROW = {
  currency: 'THB',
  rate_to_usd: '0.02816901',
  // fetched_at is 90 minutes ago — stale
  fetched_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
}

function makeExchangeRateApiResponse(rates: Record<string, number> = { USD: 1, THB: 35.5 }) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({
      result: 'success',
      conversion_rates: rates,
    }),
  }
}

function makeFromSequence(fxRows: unknown[], silosCurrencies: string[] = ['THB']) {
  let callCount = 0
  return vi.fn().mockImplementation((table: string) => {
    callCount++
    if (table === 'silos') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: silosCurrencies.map((c) => ({ base_currency: c })),
              error: null,
            }),
          }),
        }),
      }
    }
    if (table === 'fx_rates') {
      // Supports chained .select().in() for reading cached rows
      // AND .upsert() for writing fresh rows
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: fxRows, error: null }),
        }),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
    }
    return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) }
  })
}

describe('GET /api/fx-rates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.EXCHANGERATE_API_KEY = 'test-key'
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('No session') })

    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns cached rates without calling ExchangeRate-API when all rates are fresh', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'silos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [{ base_currency: 'THB' }], error: null }),
            }),
          }),
        }
      }
      if (table === 'fx_rates') {
        const freshUsdRow = {
          currency: 'USD',
          rate_to_usd: '1.00000000',
          fetched_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        }
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [FRESH_FX_ROW, freshUsdRow], error: null }),
          }),
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }
    })

    const res = await GET()
    expect(res.status).toBe(200)

    // ExchangeRate-API must NOT be called for fresh rates (AC-2)
    expect(mockFetch).not.toHaveBeenCalled()

    const body = await res.json()
    expect(body.THB).toBeDefined()
    expect(body.THB.rate_to_usd).toBe('0.02816901')
  })

  it('calls ExchangeRate-API and upserts when rates are stale', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'silos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [{ base_currency: 'THB' }], error: null }),
            }),
          }),
        }
      }
      if (table === 'fx_rates') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [STALE_FX_ROW], error: null }),
          }),
          upsert: mockUpsert,
        }
      }
    })

    mockFetch.mockResolvedValue(makeExchangeRateApiResponse())

    const res = await GET()
    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('v6.exchangerate-api.com'),
    )
    expect(mockUpsert).toHaveBeenCalledOnce()

    const body = await res.json()
    expect(body.THB).toBeDefined()
    // Fresh rate computed from new API response: 1/35.5
    expect(body.THB.rate_to_usd).toBe('0.02816901')
  })

  it('returns stale cached rates when ExchangeRate-API is unavailable (AC-4)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'silos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [{ base_currency: 'THB' }], error: null }),
            }),
          }),
        }
      }
      if (table === 'fx_rates') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [STALE_FX_ROW], error: null }),
          }),
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }
    })

    // ExchangeRate-API throws a network error
    mockFetch.mockRejectedValue(new Error('Network error'))

    const res = await GET()
    // Must NOT return an error — AC-4: return cached rates gracefully
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.THB).toBeDefined()
    expect(body.THB.rate_to_usd).toBe('0.02816901')
    // fetched_at is the stale value (original cached time, not the error time)
    expect(body.THB.fetched_at).toBe(STALE_FX_ROW.fetched_at)
  })

  it('fetches rates for all unique silo currencies + USD', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    const usdRow = {
      currency: 'USD',
      rate_to_usd: '1.00000000',
      fetched_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'silos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ base_currency: 'THB' }, { base_currency: 'USD' }],
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'fx_rates') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [FRESH_FX_ROW, usdRow], error: null }),
          }),
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.THB).toBeDefined()
    expect(body.USD).toBeDefined()
    expect(body.USD.rate_to_usd).toBe('1.00000000')
  })
})
