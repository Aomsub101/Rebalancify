/**
 * GET /api/market/top-movers?type=stocks|crypto
 *
 * Returns top 5 gainers + top 5 losers for US stocks or crypto.
 *
 * AC-1: type=stocks  → FMP /gainers + /losers (primary); Finnhub screener (fallback)
 * AC-2: type=crypto  → CoinGecko /coins/markets (no API key required)
 * AC-3: Each item: ticker, name, price (8dp string), change_pct (3dp number)
 * AC-4: All sources unavailable → stale price_cache fallback, stale:true in response
 * AC-5: change_pct is signed (positive for gainers, negative for losers) — UI renders
 *       colour + non-colour icon in STORY-026
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const FMP_API_KEY = process.env.FMP_API_KEY ?? ''
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY ?? ''
const FETCH_TIMEOUT_MS = 8_000
const TOP_N = 5

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TopMoverItem {
  ticker: string
  name: string
  price: string     // NUMERIC(20,8) as 8dp string, e.g. "875.00000000"
  change_pct: number // signed, 3dp, e.g. 4.200 or -3.100
}

interface TopMoversResponse {
  type: 'stocks' | 'crypto'
  stale: boolean
  fetched_at: string
  gainers: TopMoverItem[]
  losers: TopMoverItem[]
}

// ---------------------------------------------------------------------------
// Helper: format price as 8dp string
// ---------------------------------------------------------------------------

function fmtPrice(val: number | string): string {
  return parseFloat(String(val)).toFixed(8)
}

function fmtChangePct(val: number | string): number {
  return Math.round(parseFloat(String(val)) * 1000) / 1000
}

// ---------------------------------------------------------------------------
// FMP: /api/v3/gainers and /api/v3/losers
// ---------------------------------------------------------------------------

interface FmpMover {
  symbol: string
  name: string
  price: number
  changesPercentage: number
}

async function fetchFmpMovers(): Promise<{ gainers: TopMoverItem[]; losers: TopMoverItem[] } | null> {
  try {
    const [gRes, lRes] = await Promise.all([
      fetch(`https://financialmodelingprep.com/api/v3/gainers?apikey=${FMP_API_KEY}`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }),
      fetch(`https://financialmodelingprep.com/api/v3/losers?apikey=${FMP_API_KEY}`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }),
    ])

    if (!gRes.ok || !lRes.ok) return null

    const [gData, lData]: [FmpMover[], FmpMover[]] = await Promise.all([
      gRes.json(),
      lRes.json(),
    ])

    if (!Array.isArray(gData) || !Array.isArray(lData)) return null

    const toItem = (m: FmpMover): TopMoverItem => ({
      ticker: m.symbol,
      name: m.name,
      price: fmtPrice(m.price),
      change_pct: fmtChangePct(m.changesPercentage),
    })

    const gainers = gData
      .map(toItem)
      .sort((a, b) => b.change_pct - a.change_pct)
      .slice(0, TOP_N)

    const losers = lData
      .map(toItem)
      .sort((a, b) => a.change_pct - b.change_pct)
      .slice(0, TOP_N)

    return { gainers, losers }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Finnhub: two screener calls — one sorted desc (gainers), one sorted asc (losers)
// Uses /scan/technical-indicator endpoint (US exchange movers)
// ---------------------------------------------------------------------------

interface FinnhubMover {
  symbol: string
  description: string
  lastSalePrice: number
  netChange: number
  percentChange: number
}

interface FinnhubScreenerResult {
  result: FinnhubMover[]
}

async function fetchFinnhubMovers(): Promise<{ gainers: TopMoverItem[]; losers: TopMoverItem[] } | null> {
  try {
    const [gRes, lRes] = await Promise.all([
      fetch(
        `https://finnhub.io/api/v1/scan/technical-indicator?exchange=US&sort=percent_change_desc&token=${FINNHUB_API_KEY}`,
        { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
      ),
      fetch(
        `https://finnhub.io/api/v1/scan/technical-indicator?exchange=US&sort=percent_change_asc&token=${FINNHUB_API_KEY}`,
        { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
      ),
    ])

    if (!gRes.ok || !lRes.ok) return null

    const [gScreener, lScreener]: [FinnhubScreenerResult, FinnhubScreenerResult] =
      await Promise.all([gRes.json(), lRes.json()])

    if (!gScreener?.result || !lScreener?.result) return null

    const toItem = (m: FinnhubMover): TopMoverItem => ({
      ticker: m.symbol,
      name: m.description,
      price: fmtPrice(m.lastSalePrice),
      change_pct: fmtChangePct(m.percentChange),
    })

    const gainers = gScreener.result
      .filter((m) => typeof m.percentChange === 'number' && m.percentChange > 0)
      .map(toItem)
      .sort((a, b) => b.change_pct - a.change_pct)
      .slice(0, TOP_N)

    const losers = lScreener.result
      .filter((m) => typeof m.percentChange === 'number' && m.percentChange < 0)
      .map(toItem)
      .sort((a, b) => a.change_pct - b.change_pct)
      .slice(0, TOP_N)

    if (gainers.length === 0 && losers.length === 0) return null

    return { gainers, losers }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Stocks: FMP primary → Finnhub fallback
// ---------------------------------------------------------------------------

async function fetchStocksMovers(): Promise<{ gainers: TopMoverItem[]; losers: TopMoverItem[] } | null> {
  const fmp = await fetchFmpMovers()
  if (fmp) return fmp

  const finnhub = await fetchFinnhubMovers()
  return finnhub
}

// ---------------------------------------------------------------------------
// CoinGecko: /api/v3/coins/markets (no key required)
// ---------------------------------------------------------------------------

interface CoinGeckoCoin {
  symbol: string
  name: string
  current_price: number
  price_change_percentage_24h: number
}

async function fetchCryptoMovers(): Promise<{ gainers: TopMoverItem[]; losers: TopMoverItem[] } | null> {
  try {
    // Fetch gainers (top 100 by market cap, then sort by 24h change)
    const [gRes, lRes] = await Promise.all([
      fetch(
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=price_change_percentage_24h_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h',
        { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
      ),
      fetch(
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=price_change_percentage_24h_asc&per_page=20&page=1&sparkline=false&price_change_percentage=24h',
        { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
      ),
    ])

    if (!gRes.ok || !lRes.ok) return null

    const [gCoins, lCoins]: [CoinGeckoCoin[], CoinGeckoCoin[]] = await Promise.all([
      gRes.json(),
      lRes.json(),
    ])

    if (!Array.isArray(gCoins) || !Array.isArray(lCoins)) return null

    const toItem = (c: CoinGeckoCoin): TopMoverItem => ({
      ticker: c.symbol.toUpperCase(),
      name: c.name,
      price: fmtPrice(c.current_price),
      change_pct: fmtChangePct(c.price_change_percentage_24h ?? 0),
    })

    const gainers = gCoins
      .filter((c) => (c.price_change_percentage_24h ?? 0) > 0)
      .map(toItem)
      .sort((a, b) => b.change_pct - a.change_pct)
      .slice(0, TOP_N)

    const losers = lCoins
      .filter((c) => (c.price_change_percentage_24h ?? 0) < 0)
      .map(toItem)
      .sort((a, b) => a.change_pct - b.change_pct)
      .slice(0, TOP_N)

    return { gainers, losers }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Stale cache fallback (price_cache — no daily change available)
// ---------------------------------------------------------------------------

interface AssetRow {
  id: string
  ticker: string
  name: string
  asset_type: string
}

interface PriceCacheRow {
  asset_id: string
  price: string
  fetched_at: string
}

async function fetchStaleCache(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assetType: 'stock' | 'crypto',
): Promise<{ gainers: TopMoverItem[]; losers: TopMoverItem[] }> {
  const typeFilter = assetType === 'stock' ? 'stock' : 'crypto'

  const { data: assets } = await supabase
    .from('assets')
    .select('id, ticker, name, asset_type')
    .eq('asset_type', typeFilter)
    .select()
    .limit(50)

  const assetRows = (assets ?? []) as AssetRow[]
  if (assetRows.length === 0) return { gainers: [], losers: [] }

  const ids = assetRows.map((a) => a.id)

  const { data: prices } = await supabase
    .from('price_cache')
    .select('asset_id, price, fetched_at')
    .in('asset_id', ids)

  const priceMap = new Map<string, string>()
  for (const row of (prices ?? []) as PriceCacheRow[]) {
    priceMap.set(row.asset_id, String(row.price))
  }

  const items: TopMoverItem[] = assetRows
    .filter((a) => priceMap.has(a.id))
    .map((a) => ({
      ticker: a.ticker,
      name: a.name,
      price: fmtPrice(priceMap.get(a.id) ?? '0'),
      change_pct: 0, // no daily change data in cache
    }))

  // With no change data, split arbitrarily (empty lists are fine)
  return { gainers: items.slice(0, TOP_N), losers: [] }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

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

  let live: { gainers: TopMoverItem[]; losers: TopMoverItem[] } | null = null

  if (type === 'stocks') {
    live = await fetchStocksMovers()
  } else {
    live = await fetchCryptoMovers()
  }

  if (live) {
    const response: TopMoversResponse = {
      type,
      stale: false,
      fetched_at: new Date().toISOString(),
      gainers: live.gainers,
      losers: live.losers,
    }
    return NextResponse.json(response)
  }

  // ─── Stale cache fallback ────────────────────────────────────────────────
  const assetType = type === 'stocks' ? 'stock' : 'crypto'
  const staleData = await fetchStaleCache(supabase, assetType)

  const response: TopMoversResponse = {
    type,
    stale: true,
    fetched_at: new Date().toISOString(),
    gainers: staleData.gainers,
    losers: staleData.losers,
  }
  return NextResponse.json(response)
}
