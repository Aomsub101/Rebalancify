/**
 * Tests for GET /api/market/top-movers?type=stocks|crypto
 *
 * Cases:
 *   1. Unauthenticated → 401
 *   2. Missing type param → 400
 *   3. type=stocks, FMP gainers/losers succeeds → top 5 gainers + top 5 losers
 *   4. type=stocks, FMP fails → Finnhub fallback → 200
 *   5. type=stocks, FMP + Finnhub both fail → stale price_cache fallback, stale:true
 *   6. type=crypto, CoinGecko succeeds → top 5 gainers + top 5 losers
 *   7. type=crypto, CoinGecko fails → stale price_cache fallback, stale:true
 *   8. Response shape: each item has ticker, name, price, change_pct
 *   9. gainers sorted descending by change_pct, losers ascending
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── next/server mock ─────────────────────────────────────────────────────────
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

// ─── Supabase mock ────────────────────────────────────────────────────────────
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

function makeRequest(type?: string): Request {
  const url = type
    ? `http://localhost/api/market/top-movers?type=${type}`
    : 'http://localhost/api/market/top-movers'
  return { url, headers: { get: () => null } } as unknown as Request
}

/** FMP gainers/losers shape */
const FMP_GAINERS = [
  { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 875.0, changesPercentage: 4.2 },
  { symbol: 'AMD',  name: 'AMD',          price: 160.0, changesPercentage: 3.1 },
  { symbol: 'TSLA', name: 'Tesla',        price: 220.0, changesPercentage: 2.8 },
  { symbol: 'META', name: 'Meta',         price: 500.0, changesPercentage: 2.5 },
  { symbol: 'AMZN', name: 'Amazon',       price: 190.0, changesPercentage: 2.0 },
  { symbol: 'MSFT', name: 'Microsoft',    price: 420.0, changesPercentage: 1.5 }, // extra — should be trimmed
]
const FMP_LOSERS = [
  { symbol: 'INTC', name: 'Intel',   price: 32.5,  changesPercentage: -3.1 },
  { symbol: 'WBA',  name: 'Walgreen',price: 10.0,  changesPercentage: -2.8 },
  { symbol: 'T',    name: 'AT&T',    price: 17.0,  changesPercentage: -2.5 },
  { symbol: 'VZ',   name: 'Verizon', price: 40.0,  changesPercentage: -2.0 },
  { symbol: 'F',    name: 'Ford',    price: 12.0,  changesPercentage: -1.5 },
  { symbol: 'GM',   name: 'GM',      price: 45.0,  changesPercentage: -1.0 }, // extra
]

/** CoinGecko /coins/markets shape */
const COINGECKO_COINS = [
  { symbol: 'btc',  name: 'Bitcoin',  current_price: 65000, price_change_percentage_24h: 3.5 },
  { symbol: 'eth',  name: 'Ethereum', current_price: 3500,  price_change_percentage_24h: 2.8 },
  { symbol: 'sol',  name: 'Solana',   current_price: 150,   price_change_percentage_24h: 2.1 },
  { symbol: 'bnb',  name: 'BNB',      current_price: 580,   price_change_percentage_24h: 1.5 },
  { symbol: 'avax', name: 'Avalanche',current_price: 35,    price_change_percentage_24h: 1.2 },
  // losers (sorted desc so they'll be at the end with negative changes in losers query)
  { symbol: 'doge', name: 'Dogecoin', current_price: 0.15,  price_change_percentage_24h: -4.0 },
  { symbol: 'shib', name: 'Shiba',    current_price: 0.00002, price_change_percentage_24h: -3.2 },
  { symbol: 'xrp',  name: 'XRP',      current_price: 0.5,   price_change_percentage_24h: -2.8 },
  { symbol: 'ada',  name: 'Cardano',  current_price: 0.4,   price_change_percentage_24h: -2.0 },
  { symbol: 'trx',  name: 'TRON',     current_price: 0.1,   price_change_percentage_24h: -1.2 },
]

/** Stale price_cache fallback rows for assets of type='stock' */
function makeStaleStocksDb() {
  const priceCacheRows = [
    { asset_id: 'a1', price: '100.00000000', fetched_at: '2026-03-28T10:00:00Z' },
    { asset_id: 'a2', price: '50.00000000',  fetched_at: '2026-03-28T10:00:00Z' },
  ]
  const assetRows = [
    { id: 'a1', ticker: 'AAPL', name: 'Apple Inc.', asset_type: 'stock' },
    { id: 'a2', ticker: 'MSFT', name: 'Microsoft',  asset_type: 'stock' },
  ]
  return { priceCacheRows, assetRows }
}

function makeStaleDb() {
  mockFromImpl = (table) => {
    const { priceCacheRows, assetRows } = makeStaleStocksDb()
    if (table === 'assets') {
      return {
        select: () => ({
          eq: () => ({
            select: () => ({
              limit: () => ({ data: assetRows, error: null }),
            }),
          }),
        }),
      }
    }
    if (table === 'price_cache') {
      return {
        select: () => ({
          in: () => ({ data: priceCacheRows, error: null }),
        }),
      }
    }
    return {}
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/market/top-movers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  })

  // ---------------------------------------------------------------------------
  // 1. Unauthenticated → 401
  // ---------------------------------------------------------------------------
  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Unauthorized') })
    const res = await GET(makeRequest('stocks'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  // ---------------------------------------------------------------------------
  // 2. Missing type → 400
  // ---------------------------------------------------------------------------
  it('returns 400 when type param is missing', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_TYPE')
  })

  it('returns 400 when type param is invalid', async () => {
    const res = await GET(makeRequest('bonds'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_TYPE')
  })

  // ---------------------------------------------------------------------------
  // 3. type=stocks, FMP succeeds → top 5 gainers + top 5 losers
  // ---------------------------------------------------------------------------
  it('returns top 5 gainers and top 5 losers for stocks via FMP', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => FMP_GAINERS } as Response) // FMP gainers
      .mockResolvedValueOnce({ ok: true, json: async () => FMP_LOSERS  } as Response) // FMP losers

    const res = await GET(makeRequest('stocks'))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.type).toBe('stocks')
    expect(body.stale).toBe(false)
    expect(body.gainers).toHaveLength(5)
    expect(body.losers).toHaveLength(5)
    expect(body.gainers[0].ticker).toBe('NVDA')
    expect(body.losers[0].ticker).toBe('INTC')
  })

  // ---------------------------------------------------------------------------
  // 4. type=stocks, FMP fails → Finnhub fallback
  // ---------------------------------------------------------------------------
  it('falls back to Finnhub when FMP fails for stocks', async () => {
    // FMP gainers call fails; FMP losers call fails; Finnhub screener returns data
    const finnhubGainers = [
      { symbol: 'NVDA', description: 'NVIDIA', lastSalePrice: 875,  netChange: 35.0, percentChange: 4.2 },
      { symbol: 'AMD',  description: 'AMD',    lastSalePrice: 160,  netChange: 4.8,  percentChange: 3.1 },
      { symbol: 'TSLA', description: 'Tesla',  lastSalePrice: 220,  netChange: 6.0,  percentChange: 2.8 },
      { symbol: 'META', description: 'Meta',   lastSalePrice: 500,  netChange: 12.0, percentChange: 2.5 },
      { symbol: 'AMZN', description: 'Amazon', lastSalePrice: 190,  netChange: 3.7,  percentChange: 2.0 },
    ]
    const finnhubLosers = [
      { symbol: 'INTC', description: 'Intel',   lastSalePrice: 32.5, netChange: -1.05, percentChange: -3.1 },
      { symbol: 'WBA',  description: 'Walgreen',lastSalePrice: 10.0, netChange: -0.29, percentChange: -2.8 },
      { symbol: 'T',    description: 'AT&T',    lastSalePrice: 17.0, netChange: -0.44, percentChange: -2.5 },
      { symbol: 'VZ',   description: 'Verizon', lastSalePrice: 40.0, netChange: -0.84, percentChange: -2.0 },
      { symbol: 'F',    description: 'Ford',    lastSalePrice: 12.0, netChange: -0.18, percentChange: -1.5 },
    ]

    vi.spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('FMP unreachable'))    // FMP gainers
      .mockRejectedValueOnce(new Error('FMP unreachable'))    // FMP losers
      .mockResolvedValueOnce({                                // Finnhub gainers
        ok: true,
        json: async () => ({ result: finnhubGainers }),
      } as Response)
      .mockResolvedValueOnce({                                // Finnhub losers
        ok: true,
        json: async () => ({ result: finnhubLosers }),
      } as Response)

    const res = await GET(makeRequest('stocks'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.stale).toBe(false)
    expect(body.gainers).toHaveLength(5)
    expect(body.losers).toHaveLength(5)
    expect(body.gainers[0].ticker).toBe('NVDA')
  })

  // ---------------------------------------------------------------------------
  // 5. type=stocks, FMP + Finnhub both fail → stale cache fallback, stale:true
  // ---------------------------------------------------------------------------
  it('returns stale cache when FMP and Finnhub both fail for stocks', async () => {
    makeStaleDb()
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network down'))

    const res = await GET(makeRequest('stocks'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.stale).toBe(true)
    expect(body.type).toBe('stocks')
    // gainers and losers may be empty arrays or partial from cache
    expect(Array.isArray(body.gainers)).toBe(true)
    expect(Array.isArray(body.losers)).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // 6. type=crypto, CoinGecko succeeds → top 5 gainers + top 5 losers
  // ---------------------------------------------------------------------------
  it('returns top 5 gainers and top 5 losers for crypto via CoinGecko', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => COINGECKO_COINS } as Response) // gainers
      .mockResolvedValueOnce({ ok: true, json: async () => COINGECKO_COINS } as Response) // losers

    const res = await GET(makeRequest('crypto'))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.type).toBe('crypto')
    expect(body.stale).toBe(false)
    expect(body.gainers).toHaveLength(5)
    expect(body.losers).toHaveLength(5)
    // gainers: highest positive change_pct first
    expect(body.gainers[0].change_pct).toBeGreaterThan(0)
    // losers: most negative change_pct first (most negative = biggest loss)
    expect(body.losers[0].change_pct).toBeLessThan(0)
  })

  // ---------------------------------------------------------------------------
  // 7. type=crypto, CoinGecko fails → stale cache fallback, stale:true
  // ---------------------------------------------------------------------------
  it('returns stale cache when CoinGecko fails for crypto', async () => {
    const priceCacheRows = [
      { asset_id: 'c1', price: '65000.00000000', fetched_at: '2026-03-28T10:00:00Z' },
    ]
    const assetRows = [
      { id: 'c1', ticker: 'BTC', name: 'Bitcoin', asset_type: 'crypto' },
    ]
    mockFromImpl = (table) => {
      if (table === 'assets') {
        return {
          select: () => ({
            eq: () => ({
              select: () => ({
                limit: () => ({ data: assetRows, error: null }),
              }),
            }),
          }),
        }
      }
      if (table === 'price_cache') {
        return {
          select: () => ({
            in: () => ({ data: priceCacheRows, error: null }),
          }),
        }
      }
      return {}
    }
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('CoinGecko down'))

    const res = await GET(makeRequest('crypto'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.stale).toBe(true)
    expect(body.type).toBe('crypto')
    expect(Array.isArray(body.gainers)).toBe(true)
    expect(Array.isArray(body.losers)).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // 8. Response shape: ticker, name, price (8dp string), change_pct (3dp)
  // ---------------------------------------------------------------------------
  it('formats price as 8-decimal string and change_pct as 3-decimal number', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => FMP_GAINERS } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => FMP_LOSERS  } as Response)

    const res = await GET(makeRequest('stocks'))
    expect(res.status).toBe(200)
    const body = await res.json()

    const gainer = body.gainers[0]
    expect(gainer).toHaveProperty('ticker')
    expect(gainer).toHaveProperty('name')
    expect(gainer).toHaveProperty('price')
    expect(gainer).toHaveProperty('change_pct')
    // price must be a string with 8 decimal places
    expect(typeof gainer.price).toBe('string')
    expect(gainer.price).toMatch(/^\d+\.\d{8}$/)
    // change_pct must be a number rounded to 3dp
    expect(typeof gainer.change_pct).toBe('number')
    expect(gainer.change_pct).toBeCloseTo(4.2, 2)
  })

  // ---------------------------------------------------------------------------
  // 9. Gainers sorted desc by change_pct, losers sorted asc (most negative first)
  // ---------------------------------------------------------------------------
  it('sorts gainers descending and losers ascending by change_pct', async () => {
    // FMP returns data in arbitrary order — we need the route to sort
    const shuffledGainers = [...FMP_GAINERS].sort(() => Math.random() - 0.5).slice(0, 5)
    const shuffledLosers  = [...FMP_LOSERS ].sort(() => Math.random() - 0.5).slice(0, 5)

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => shuffledGainers } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => shuffledLosers  } as Response)

    const res = await GET(makeRequest('stocks'))
    expect(res.status).toBe(200)
    const body = await res.json()

    // gainers: each item's change_pct >= next
    for (let i = 0; i < body.gainers.length - 1; i++) {
      expect(body.gainers[i].change_pct).toBeGreaterThanOrEqual(body.gainers[i + 1].change_pct)
    }
    // losers: each item's change_pct <= next (most negative first)
    for (let i = 0; i < body.losers.length - 1; i++) {
      expect(body.losers[i].change_pct).toBeLessThanOrEqual(body.losers[i + 1].change_pct)
    }
  })
})
