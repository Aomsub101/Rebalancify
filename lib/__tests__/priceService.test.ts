import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchPrice } from '../priceService'

function makeCacheRow(overrides: Partial<{
  price: string; currency: string; source: string; is_fresh: boolean
}> = {}) {
  return {
    asset_id: 'asset-1',
    price: '185.20000000',
    currency: 'USD',
    source: 'finnhub',
    fetched_at: new Date().toISOString(),
    is_fresh: true,
    ...overrides,
  }
}

function makeSupabase(cacheData: unknown) {
  const mockUpsert = vi.fn().mockResolvedValue({ error: null })
  const client = {
    from: vi.fn((table: string) => {
      if (table === 'price_cache_fresh') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: cacheData, error: null }),
            }),
          }),
        }
      }
      return { upsert: mockUpsert }
    }),
    _mockUpsert: mockUpsert,
  }
  return client
}

describe('fetchPrice', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns cached price and does NOT call fetch when is_fresh is true', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    const supabase = makeSupabase(makeCacheRow({ is_fresh: true }))

    const result = await fetchPrice(supabase as any, 'asset-1', 'AAPL', 'finnhub')

    expect(result.fromCache).toBe(true)
    expect(result.price).toBe('185.20000000')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('calls Finnhub and upserts when cache is stale', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ c: 200.5 }),
    } as Response)
    const supabase = makeSupabase(makeCacheRow({ is_fresh: false }))

    const result = await fetchPrice(supabase as any, 'asset-1', 'AAPL', 'finnhub')

    expect(result.fromCache).toBe(false)
    expect(result.price).toBe('200.50000000')
    expect(global.fetch).toHaveBeenCalledOnce()
    expect(supabase._mockUpsert).toHaveBeenCalledOnce()
  })

  it('calls Finnhub and upserts when no cache row exists', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ c: 185.2 }),
    } as Response)
    const supabase = makeSupabase(null)  // no cache row

    const result = await fetchPrice(supabase as any, 'asset-1', 'AAPL', 'finnhub')

    expect(result.fromCache).toBe(false)
    expect(result.price).toBe('185.20000000')
  })

  it('calls CoinGecko for crypto assets', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ bitcoin: { usd: 65000 } }),
    } as Response)
    const supabase = makeSupabase(null)

    const result = await fetchPrice(supabase as any, 'asset-2', 'BTC', 'coingecko', 'bitcoin')

    expect(result.price).toBe('65000.00000000')
    expect(result.currency).toBe('USD')
    expect(result.source).toBe('coingecko')
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain('bitcoin')
  })

  it('throws when Finnhub returns non-ok status', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: false, status: 503 } as Response)
    const supabase = makeSupabase(null)

    await expect(
      fetchPrice(supabase as any, 'asset-1', 'AAPL', 'finnhub')
    ).rejects.toThrow('Finnhub quote failed')
  })
})
