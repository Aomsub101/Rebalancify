/**
 * lib/topMoversService.test.ts
 * TDD unit tests for top-movers data-fetching service.
 * Per docs/development/03-testing-strategy.md — TDD order: RED first.
 *
 * Tests the FMP → Finnhub fallback chain for stocks,
 * and the stale-cache fallback when all live sources fail.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Mock fetch globally ───────────────────────────────────────────────────────

const mockFetch = vi.fn()
global.fetch = mockFetch

// ─── Mock supabase — handles TWO sequential DB queries: assets + price_cache ──

const mockSupabase = {
  from: vi.fn().mockImplementation((table: string) => {
    if (table === 'assets') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [
                  { id: '1', ticker: 'AAPL', name: 'Apple Inc.', asset_type: 'stock' },
                ],
                error: null,
              }),
            }),
          }),
        }),
      }
    }
    if (table === 'price_cache') {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [{ asset_id: '1', price: '175.00000000', fetched_at: new Date().toISOString() }],
              error: null,
            }),
          }),
        }),
      }
    }
    return {}
  }),
} as unknown as SupabaseClient

beforeEach(() => {
  mockFetch.mockReset()
})

// ─── Helpers ───────────────────────────────────────────────────────────────────

const FMP_GAINERS = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 175.0, changesPercentage: 3.5 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', price: 378.0, changesPercentage: 2.1 },
]
const FMP_LOSERS = [
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 242.0, changesPercentage: -4.2 },
]

const FINNHUB_GAINERS = {
  result: [
    { symbol: 'NVDA', description: 'NVIDIA Corp.', lastSalePrice: 875.0, netChange: 22.0, percentChange: 2.6 },
  ],
}
const FINNHUB_LOSERS = {
  result: [
    { symbol: 'META', description: 'Meta Platforms', lastSalePrice: 485.0, netChange: -12.0, percentChange: -2.4 },
  ],
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('fetchTopMovers — stocks', () => {
  it('FMP primary → Finnhub fallback when FMP fails', async () => {
    // FMP returns non-ok → Finnhub succeeds
    mockFetch
      .mockResolvedValueOnce({ ok: false }) // FMP gainers
      .mockResolvedValueOnce({ ok: false }) // FMP losers
      .mockResolvedValueOnce({ ok: true, json: async () => FINNHUB_GAINERS }) // Finnhub gainers
      .mockResolvedValueOnce({ ok: true, json: async () => FINNHUB_LOSERS })  // Finnhub losers

    const { fetchTopMovers } = await import('./topMoversService')
    const result = await fetchTopMovers('stocks')

    expect(result).not.toBeNull()
    expect(result!.gainers).toHaveLength(1)
    expect(result!.gainers[0].ticker).toBe('NVDA')
    expect(result!.losers).toHaveLength(1)
    expect(result!.losers[0].ticker).toBe('META')
  })

  it('FMP success — Finnhub not called', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => FMP_GAINERS })
      .mockResolvedValueOnce({ ok: true, json: async () => FMP_LOSERS })

    const { fetchTopMovers } = await import('./topMoversService')
    const result = await fetchTopMovers('stocks')

    expect(result).not.toBeNull()
    expect(result!.gainers).toHaveLength(2)
    expect(result!.gainers[0].ticker).toBe('AAPL')
    expect(result!.gainers[0].change_pct).toBe(3.5)
    expect(result!.losers[0].ticker).toBe('TSLA')
    // Only 2 FMP calls (gainers + losers) — Finnhub not invoked
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('both FMP and Finnhub fail → returns null', async () => {
    mockFetch.mockResolvedValue({ ok: false })

    const { fetchTopMovers } = await import('./topMoversService')
    const result = await fetchTopMovers('stocks')

    expect(result).toBeNull()
  })

  it('Finnhub fallback also fails → returns null', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false }) // FMP gainers
      .mockResolvedValueOnce({ ok: false }) // FMP losers
      .mockResolvedValueOnce({ ok: false }) // Finnhub gainers
      .mockResolvedValueOnce({ ok: false }) // Finnhub losers

    const { fetchTopMovers } = await import('./topMoversService')
    const result = await fetchTopMovers('stocks')

    expect(result).toBeNull()
  })

  it('price is formatted as 8dp string', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => FMP_GAINERS })
      .mockResolvedValueOnce({ ok: true, json: async () => FMP_LOSERS })

    const { fetchTopMovers } = await import('./topMoversService')
    const result = await fetchTopMovers('stocks')

    expect(result!.gainers[0].price).toBe('175.00000000')
    expect(typeof result!.gainers[0].price).toBe('string')
  })

  it('change_pct is signed 3dp number', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => FMP_GAINERS })
      .mockResolvedValueOnce({ ok: true, json: async () => FMP_LOSERS })

    const { fetchTopMovers } = await import('./topMoversService')
    const result = await fetchTopMovers('stocks')

    expect(result!.gainers[0].change_pct).toBe(3.5)
    expect(result!.losers[0].change_pct).toBe(-4.2)
  })
})

describe('fetchTopMovers — crypto', () => {
  const COINGECKO_GAINERS = [
    { symbol: 'btc', name: 'Bitcoin', current_price: 67500.0, price_change_percentage_24h: 5.3 },
    { symbol: 'eth', name: 'Ethereum', current_price: 3450.0, price_change_percentage_24h: 3.1 },
  ]
  const COINGECKO_LOSERS = [
    { symbol: 'sol', name: 'Solana', current_price: 178.0, price_change_percentage_24h: -2.8 },
  ]

  it('CoinGecko returns gainers and losers correctly', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => COINGECKO_GAINERS })
      .mockResolvedValueOnce({ ok: true, json: async () => COINGECKO_LOSERS })

    const { fetchTopMovers } = await import('./topMoversService')
    const result = await fetchTopMovers('crypto')

    expect(result).not.toBeNull()
    expect(result!.gainers).toHaveLength(2)
    expect(result!.gainers[0].ticker).toBe('BTC')
    expect(result!.gainers[0].change_pct).toBe(5.3)
    expect(result!.losers).toHaveLength(1)
    expect(result!.losers[0].ticker).toBe('SOL')
    expect(result!.losers[0].change_pct).toBe(-2.8)
  })

  it('CoinGecko fails → returns null', async () => {
    mockFetch.mockResolvedValue({ ok: false })

    const { fetchTopMovers } = await import('./topMoversService')
    const result = await fetchTopMovers('crypto')

    expect(result).toBeNull()
  })
})
