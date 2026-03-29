import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import { NextRequest } from 'next/server'

const mockGetUser = vi.fn()
const mockIn = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

// Default Supabase from() chain: no assets in DB → id: null for all tickers
function mockFromEmpty() {
  mockFrom.mockReturnValue({
    select: mockSelect.mockReturnValue({
      in: mockIn.mockResolvedValue({ data: [], error: null }),
    }),
  })
}

const AUTHED = { data: { user: { id: 'user-1' } }, error: null }
const UNAUTHED = { data: { user: null }, error: null }

describe('GET /api/assets/search', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockGetUser.mockResolvedValue(AUTHED)
    mockFromEmpty()
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValueOnce(UNAUTHED)
    const req = new NextRequest('http://localhost/api/assets/search?q=apple&type=stock')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when q is missing', async () => {
    const req = new NextRequest('http://localhost/api/assets/search?type=stock')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when type is invalid', async () => {
    const req = new NextRequest('http://localhost/api/assets/search?q=apple&type=bond')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns ranked stock results from Finnhub', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 1,
          result: [{ description: 'Apple Inc', displaySymbol: 'AAPL', symbol: 'AAPL', type: 'Common Stock' }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ c: 185.2 }),
      } as Response)

    const req = new NextRequest('http://localhost/api/assets/search?q=apple&type=stock')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].ticker).toBe('AAPL')
    expect(body[0].name).toBe('Apple Inc')
    expect(body[0].asset_type).toBe('stock')
    expect(body[0].price_source).toBe('finnhub')
    expect(body[0].current_price).toBe('185.20000000')
  })

  it('maps Finnhub ETP type to asset_type etf', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 1,
          result: [{ description: 'SPDR S&P 500', displaySymbol: 'SPY', symbol: 'SPY', type: 'ETP' }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ c: 500.0 }),
      } as Response)

    const req = new NextRequest('http://localhost/api/assets/search?q=spy&type=stock')
    const res = await GET(req)
    const body = await res.json()
    expect(body[0].asset_type).toBe('etf')
  })

  it('returns crypto results from CoinGecko', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          coins: [{ id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', market_cap_rank: 1 }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bitcoin: { usd: 65000 } }),
      } as Response)

    const req = new NextRequest('http://localhost/api/assets/search?q=bitcoin&type=crypto')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body[0].ticker).toBe('BTC')
    expect(body[0].coingecko_id).toBe('bitcoin')
    expect(body[0].asset_type).toBe('crypto')
    expect(body[0].price_source).toBe('coingecko')
    expect(body[0].current_price).toBe('65000.00000000')
  })

  it('returns 503 BROKER_UNAVAILABLE when Finnhub search fails', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: false, status: 500 } as Response)
    const req = new NextRequest('http://localhost/api/assets/search?q=apple&type=stock')
    const res = await GET(req)
    const body = await res.json()
    expect(res.status).toBe(503)
    expect(body.error.code).toBe('BROKER_UNAVAILABLE')
  })

  it('returns 503 BROKER_UNAVAILABLE when CoinGecko search fails', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: false, status: 429 } as Response)
    const req = new NextRequest('http://localhost/api/assets/search?q=bitcoin&type=crypto')
    const res = await GET(req)
    expect(res.status).toBe(503)
  })

  // ---------------------------------------------------------------------------
  // id field tests (STORY-026 — needed for AssetPeerSearch → peers endpoint)
  // ---------------------------------------------------------------------------

  it('returns id: null when ticker is not registered in the assets table', async () => {
    // AAPL not in DB
    mockFrom.mockReturnValue({
      select: mockSelect.mockReturnValue({
        in: mockIn.mockResolvedValue({ data: [], error: null }),
      }),
    })

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 1,
          result: [{ description: 'Apple Inc', displaySymbol: 'AAPL', symbol: 'AAPL', type: 'Common Stock' }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ c: 185.2 }),
      } as Response)

    const req = new NextRequest('http://localhost/api/assets/search?q=apple&type=stock')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body[0].id).toBeNull()
  })

  it('returns id UUID when ticker is registered in the assets table', async () => {
    const AAPL_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

    mockFrom.mockReturnValue({
      select: mockSelect.mockReturnValue({
        in: mockIn.mockResolvedValue({
          data: [{ id: AAPL_UUID, ticker: 'AAPL' }],
          error: null,
        }),
      }),
    })

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 1,
          result: [{ description: 'Apple Inc', displaySymbol: 'AAPL', symbol: 'AAPL', type: 'Common Stock' }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ c: 185.2 }),
      } as Response)

    const req = new NextRequest('http://localhost/api/assets/search?q=apple&type=stock')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body[0].id).toBe(AAPL_UUID)
  })
})
