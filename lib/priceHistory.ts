/**
 * lib/priceHistory.ts
 * TODO(STORY-044): activate this — wire to /api/market/price-history endpoint
 *                  and remove this comment once asset_historical_data table is
 *                  populated via the yfinance UPSERT pipeline.
 * Stale-while-revalidate price history fetch service.
 * Uses yahoo-finance2 to fetch up to 5 years of daily OHLCV data,
 * caches in Supabase asset_historical_data, and returns PriceSeries.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import YahooFinance from 'yahoo-finance2'
import { type HistoricalRowHistory } from 'yahoo-finance2/modules/historical'

export interface PricePoint {
  date: string       // "YYYY-MM-DD"
  close: number
}

export interface PriceSeries {
  ticker: string
  prices: PricePoint[]
  last_updated: string  // ISO timestamp
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000  // 24 hours

function isCacheFresh(lastUpdated: Date): boolean {
  return Date.now() - lastUpdated.getTime() < CACHE_TTL_MS
}

function sortPricesAscending(prices: PricePoint[]): PricePoint[] {
  return [...prices].sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Fetches historical daily closing prices for a ticker, using a stale-while-revalidate
 * cache in Supabase asset_historical_data.
 *
 * Logic:
 * 1. Check Supabase for the ticker.
 * 2. Cache hit (last_updated < 24h): return cached data.
 * 3. Cache miss OR stale (last_updated >= 24h): fetch from yfinance, upsert, return.
 *
 * @param ticker - Stock/ETF ticker symbol (e.g. "AAPL")
 * @param supabase - Supabase client (service-role recommended)
 */
export async function fetchPriceHistory(
  ticker: string,
  supabase: SupabaseClient
): Promise<PriceSeries> {
  // ── Step 1: Check cache ────────────────────────────────────────────────────
  // Supabase .single() throws error with code 'PGRST116' when no rows found
  const { data: cachedRow, error: cacheError } = await supabase
    .from('asset_historical_data')
    .select('ticker, historical_prices, last_updated')
    .eq('ticker', ticker)
    .single()

  const isCacheMiss =
    cacheError !== null && (cacheError as { code?: string }).code === 'PGRST116'

  if (!isCacheMiss && cachedRow !== null) {
    // Cache hit or stale — check freshness
    const lastUpdated = new Date(cachedRow.last_updated)
    if (isCacheFresh(lastUpdated)) {
      return {
        ticker,
        prices: cachedRow.historical_prices as PricePoint[],
        last_updated: cachedRow.last_updated,
      }
    }
  }

  // If error is not PGRST116, it's a real error — throw
  if (cacheError !== null && (cacheError as { code?: string }).code !== 'PGRST116') {
    throw new Error(`Failed to query asset_historical_data: ${cacheError.message}`)
  }

  // ── Step 3: Cache miss or stale — fetch from yfinance ────────────────────
  let rawResults: HistoricalRowHistory[]
  try {
    rawResults = await YahooFinance.historical(ticker, {
      period1: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
      period2: new Date(),
      interval: '1d',
    })
  } catch (err) {
    throw new Error(`yfinance fetch failed for ${ticker}: ${(err as Error).message}`)
  }

  const prices: PricePoint[] = sortPricesAscending(
    rawResults.map(r => ({
      date: r.date.toISOString().split('T')[0]!,  // "YYYY-MM-DD"
      close: r.close,
    }))
  )

  const now = new Date().toISOString()

  // ── Step 4: Upsert into Supabase ───────────────────────────────────────────
  const { error: upsertError } = await supabase
    .from('asset_historical_data')
    .upsert({
      ticker,
      historical_prices: prices,
      last_updated: now,
    })

  if (upsertError) {
    throw new Error(`Failed to upsert price history for ${ticker}: ${upsertError.message}`)
  }

  return { ticker, prices, last_updated: now }
}
