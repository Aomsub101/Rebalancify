/**
 * lib/topMoversService.test.ts
 * Tests the stock and crypto live-source chains.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
global.fetch = mockFetch

beforeEach(() => {
  mockFetch.mockReset()
})

const FMP_GAINERS = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 175.0, changesPercentage: 3.5 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', price: 378.0, changesPercentage: 2.1 },
]
const FMP_LOSERS = [
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 242.0, changesPercentage: -4.2 },
]

describe('fetchTopMovers stocks', () => {
  it('uses Finnhub fallback when FMP fails', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ c: 875.0, dp: 2.6 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'NVIDIA Corp.' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ c: 485.0, dp: -2.4 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'Meta Platforms' }) })
      .mockResolvedValue({ ok: false })

    const { fetchTopMovers } = await import('./topMoversService')
    const result = await fetchTopMovers('stocks')

    expect(result).not.toBeNull()
    expect(result!.gainers.length).toBeGreaterThan(0)
    expect(result!.losers.length).toBeGreaterThan(0)
  })

  it('uses FMP when available', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => FMP_GAINERS })
      .mockResolvedValueOnce({ ok: true, json: async () => FMP_LOSERS })

    const { fetchTopMovers } = await import('./topMoversService')
    const result = await fetchTopMovers('stocks')

    expect(result).not.toBeNull()
    expect(result!.gainers).toHaveLength(2)
    expect(result!.gainers[0].ticker).toBe('AAPL')
    expect(result!.losers[0].ticker).toBe('TSLA')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('returns null when all stock sources fail', async () => {
    mockFetch.mockResolvedValue({ ok: false })

    const { fetchTopMovers } = await import('./topMoversService')
    const result = await fetchTopMovers('stocks')

    expect(result).toBeNull()
  })
})

describe('fetchTopMovers crypto', () => {
  const COINGECKO_GAINERS = [
    { symbol: 'btc', name: 'Bitcoin', current_price: 67500.0, price_change_percentage_24h: 5.3 },
    { symbol: 'eth', name: 'Ethereum', current_price: 3450.0, price_change_percentage_24h: 3.1 },
  ]
  const COINGECKO_LOSERS = [
    { symbol: 'sol', name: 'Solana', current_price: 178.0, price_change_percentage_24h: -2.8 },
  ]

  it('returns gainers and losers from CoinGecko', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => COINGECKO_GAINERS })
      .mockResolvedValueOnce({ ok: true, json: async () => COINGECKO_LOSERS })

    const { fetchTopMovers } = await import('./topMoversService')
    const result = await fetchTopMovers('crypto')

    expect(result).not.toBeNull()
    expect(result!.gainers[0].ticker).toBe('BTC')
    expect(result!.losers[0].ticker).toBe('SOL')
  })

  it('returns null when CoinGecko fails', async () => {
    mockFetch.mockResolvedValue({ ok: false })

    const { fetchTopMovers } = await import('./topMoversService')
    const result = await fetchTopMovers('crypto')

    expect(result).toBeNull()
  })
})
