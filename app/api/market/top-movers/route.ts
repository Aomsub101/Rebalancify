/**
 * GET /api/market/top-movers?type=stocks|crypto
 *
 * Thin auth+validation wrapper around lib/topMoversService.
 * All data-fetching logic is in lib/topMoversService.ts.
 *
 * AC-1: type=stocks  → FMP /gainers + /losers (primary); Finnhub screener (fallback)
 * AC-2: type=crypto  → CoinGecko /coins/markets (no API key required)
 * AC-3: Each item: ticker, name, price (8dp string), change_pct (3dp number)
 * AC-4: All sources unavailable → stale price_cache fallback, stale:true in response
 * AC-5: change_pct is signed (positive for gainers, negative for losers)
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchTopMovers, fetchStaleCache, type TopMoverItem } from '@/lib/topMoversService'

interface TopMoversResponse {
  type: 'stocks' | 'crypto'
  stale: boolean
  fetched_at: string
  gainers: TopMoverItem[]
  losers: TopMoverItem[]
}

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 },
    )
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  if (type !== 'stocks' && type !== 'crypto') {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_TYPE',
          message: "Query param 'type' must be 'stocks' or 'crypto'",
        },
      },
      { status: 400 },
    )
  }

  // Try live sources via the service
  const result = await fetchTopMovers(type)

  if (result) {
    return NextResponse.json({
      type,
      stale: false,
      fetched_at: new Date().toISOString(),
      gainers: result.gainers,
      losers: result.losers,
    } satisfies TopMoversResponse)
  }

  // All live sources failed — stale cache fallback for both stocks and crypto
  const assetType = type === 'stocks' ? 'stock' : 'crypto'
  const staleData = await fetchStaleCache(supabase, assetType)

  return NextResponse.json({
    type,
    stale: true,
    fetched_at: new Date().toISOString(),
    gainers: staleData.gainers,
    losers: staleData.losers,
  } satisfies TopMoversResponse)
}
