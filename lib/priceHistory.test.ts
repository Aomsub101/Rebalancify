/**
 * lib/priceHistory.test.ts
 * TDD Red phase: failing tests for fetchPriceHistory SWR cache logic.
 *
 * Tests the stale-while-revalidate pattern:
 * - Cache hit (< 24h old): return cached data, no yfinance call
 * - Cache miss (ticker not in DB): fetch yfinance, upsert, return
 * - Stale cache (> 24h old): fetch yfinance, upsert, return
 * - yfinance error: throw with ticker name in message
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { HistoricalRowHistory } from 'yahoo-finance2/modules/historical'

// Mock yahoo-finance2 before importing priceHistory
vi.mock('yahoo-finance2', () => ({
  __esModule: true,
  default: {
    historical: vi.fn<() => Promise<HistoricalRowHistory[]>>(),
  },
}))

import YahooFinance from 'yahoo-finance2'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yfHistorical = YahooFinance.historical as any
import { fetchPriceHistory } from './priceHistory'

// ─── Supabase mock helper ──────────────────────────────────────────────────────

type MockSupabase = ReturnType<typeof makeMockSupabase>

function makeMockSupabase(setup: {
  // Pass selectData when there IS data (fresh or stale); omit to simulate PGRST116 cache miss
  selectData?: {
    ticker: string
    historical_prices: Array<{ date: string; close: number }>
    last_updated: string
  }
}) {
  const mockUpsert = vi.fn().mockResolvedValue({ error: null })

  // Supabase .single() returns error with code 'PGRST116' when no rows found
  const PGRST116_ERROR = { code: 'PGRST116', message: 'No rows found' }

  // If selectData is provided → row exists (error: null)
  // If selectData is omitted → cache miss (error: PGRST116)
  const selectResult = setup.selectData !== undefined
    ? { data: setup.selectData, error: null }
    : { data: null, error: PGRST116_ERROR }

  const fromFn = vi.fn((table: string) => {
    if (table === 'asset_historical_data') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue(selectResult),
          }),
        }),
        upsert: mockUpsert,
      }
    }
    return { upsert: mockUpsert }
  })

  return {
    from: fromFn,
    _mockUpsert: mockUpsert,
  }
}

// ─── yfinance mock historical result ─────────────────────────────────────────

function makeYfinanceResult(ticker: string, prices: Array<{ date: string; close: number }>) {
  return prices.map(p => ({
    symbol: ticker,
    date: new Date(p.date),
    open: p.close,
    high: p.close,
    low: p.close,
    close: p.close,
    adjClose: p.close,
    volume: 0,
  }))
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('fetchPriceHistory', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.clearAllMocks()
  })

  it('returns cached data without calling yfinance when last_updated < 24h ago (cache hit)', async () => {
    const recentRow = {
      ticker: 'AAPL',
      historical_prices: [
        { date: '2025-01-01', close: 185.0 },
        { date: '2025-01-02', close: 186.0 },
      ],
      last_updated: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1h ago (fresh)
    }
    const supabase = makeMockSupabase({ selectData: recentRow })

    const result = await fetchPriceHistory('AAPL', supabase as any)

    expect(result.ticker).toBe('AAPL')
    expect(result.prices).toEqual([
      { date: '2025-01-01', close: 185.0 },
      { date: '2025-01-02', close: 186.0 },
    ])
    expect(result.last_updated).toBe(recentRow.last_updated)
    expect(yfHistorical).not.toHaveBeenCalled()
  })

  it('calls yfinance and upserts when ticker is not in DB (cache miss)', async () => {
    const supabase = makeMockSupabase({}) // no row → PGRST116 error triggers cache miss

    const yfinancePrices = [
      { date: '2025-01-01', close: 185.0 },
      { date: '2025-01-02', close: 186.0 },
    ]
    yfHistorical.mockResolvedValueOnce(
      makeYfinanceResult('AAPL', yfinancePrices)
    )

    const result = await fetchPriceHistory('AAPL', supabase as any)

    expect(YahooFinance.historical).toHaveBeenCalledOnce()
    expect(supabase._mockUpsert).toHaveBeenCalledOnce()
    expect(result.ticker).toBe('AAPL')
    expect(result.prices).toHaveLength(2)
    expect(result.prices[0]).toEqual({ date: '2025-01-01', close: 185.0 })
  })

  it('calls yfinance and upserts when last_updated > 24h ago (stale cache)', async () => {
    const staleRow = {
      ticker: 'AAPL',
      historical_prices: [{ date: '2024-01-01', close: 180.0 }],
      last_updated: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25h ago (stale)
    }
    const supabase = makeMockSupabase({ selectData: staleRow })

    const yfinancePrices = [{ date: '2025-01-01', close: 185.0 }]
    yfHistorical.mockResolvedValueOnce(
      makeYfinanceResult('AAPL', yfinancePrices)
    )

    const result = await fetchPriceHistory('AAPL', supabase as any)

    expect(yfHistorical).toHaveBeenCalledOnce()
    expect(supabase._mockUpsert).toHaveBeenCalledOnce()
    expect(result.ticker).toBe('AAPL')
    expect(result.prices[0].close).toBe(185.0)
  })

  it('throws an error with the ticker name when yfinance fails', async () => {
    const supabase = makeMockSupabase({}) // PGRST116 → cache miss → yfinance called

    yfHistorical.mockRejectedValue(
      new Error('Socket hang up')
    )

    // First call: yfinance throws → expect error includes ticker and 'yfinance'
    await expect(fetchPriceHistory('AAPL', supabase as any)).rejects.toThrow('AAPL')
    await expect(fetchPriceHistory('AAPL', supabase as any)).rejects.toThrow('yfinance')
  })

  it('sorts prices by date ascending', async () => {
    const supabase = makeMockSupabase({}) // PGRST116 → cache miss → yfinance called

    // yfinance returns out-of-order dates
    const yfinancePrices = [
      { date: '2025-01-03', close: 187.0 },
      { date: '2025-01-01', close: 185.0 },
      { date: '2025-01-02', close: 186.0 },
    ]
    yfHistorical.mockResolvedValueOnce(
      makeYfinanceResult('AAPL', yfinancePrices)
    )

    const result = await fetchPriceHistory('AAPL', supabase as any)

    expect(result.prices[0].date).toBe('2025-01-01')
    expect(result.prices[1].date).toBe('2025-01-02')
    expect(result.prices[2].date).toBe('2025-01-03')
  })
})
