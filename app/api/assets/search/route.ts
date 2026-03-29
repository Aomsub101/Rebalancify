import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

const VALID_TYPES = ['stock', 'crypto'] as const
type AssetType = typeof VALID_TYPES[number]

interface FinnhubSearchResult {
  description: string
  displaySymbol: string
  symbol: string
  type: string
}

interface CoinGeckoSearchCoin {
  id: string
  name: string
  symbol: string
  market_cap_rank: number | null
}

// ---------------------------------------------------------------------------
// Helper: batch-lookup asset IDs by ticker from the assets table.
// Returns a Map<ticker, uuid>. Tickers not in DB map to undefined.
// ---------------------------------------------------------------------------

async function lookupAssetIds(
  supabase: SupabaseClient,
  tickers: string[],
): Promise<Map<string, string>> {
  if (tickers.length === 0) return new Map()
  const { data } = await supabase
    .from('assets')
    .select('id, ticker')
    .in('ticker', tickers)
  const map = new Map<string, string>()
  for (const row of (data ?? []) as { id: string; ticker: string }[]) {
    map.set(row.ticker, row.id)
  }
  return map
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 },
    )
  }

  const { searchParams } = request.nextUrl
  const q = searchParams.get('q')
  const type = searchParams.get('type')

  if (!q || q.trim() === '') {
    return NextResponse.json(
      { error: { code: 'INVALID_VALUE', message: 'q is required' } },
      { status: 400 },
    )
  }

  if (!type || !VALID_TYPES.includes(type as AssetType)) {
    return NextResponse.json(
      { error: { code: 'INVALID_VALUE', message: 'type must be stock or crypto' } },
      { status: 400 },
    )
  }

  if (type === 'stock') {
    return searchStocks(q, supabase)
  } else {
    return searchCrypto(q, supabase)
  }
}

// ---------------------------------------------------------------------------
// Stock search (Finnhub)
// ---------------------------------------------------------------------------

async function searchStocks(q: string, supabase: SupabaseClient) {
  const apiKey = process.env.FINNHUB_API_KEY ?? ''

  let searchData: { count: number; result: FinnhubSearchResult[] }
  try {
    const searchRes = await fetch(
      `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&exchange=US&token=${apiKey}`,
    )
    if (!searchRes.ok) {
      return NextResponse.json(
        { error: { code: 'BROKER_UNAVAILABLE', message: 'Finnhub search unavailable' } },
        { status: 503 },
      )
    }
    searchData = await searchRes.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'BROKER_UNAVAILABLE', message: 'Finnhub search unavailable' } },
      { status: 503 },
    )
  }

  const top5 = (searchData.result ?? []).slice(0, 5)

  const rawResults = await Promise.all(
    top5.map(async (item) => {
      let price = '0.00000000'
      try {
        const quoteRes = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(item.symbol)}&token=${apiKey}`,
        )
        if (quoteRes.ok) {
          const quoteData = await quoteRes.json()
          price = (quoteData.c as number).toFixed(8)
        }
      } catch {
        // leave price as default
      }

      return {
        ticker: item.displaySymbol,
        name: item.description,
        asset_type: item.type === 'ETP' ? 'etf' : 'stock',
        price_source: 'finnhub',
        current_price: price,
      }
    }),
  )

  const idMap = await lookupAssetIds(supabase, rawResults.map((r) => r.ticker))
  const results = rawResults.map((r) => ({ ...r, id: idMap.get(r.ticker) ?? null }))

  return NextResponse.json(results)
}

// ---------------------------------------------------------------------------
// Crypto search (CoinGecko)
// ---------------------------------------------------------------------------

async function searchCrypto(q: string, supabase: SupabaseClient) {
  const apiKey = process.env.COINGECKO_API_KEY ?? ''

  let coins: CoinGeckoSearchCoin[]
  try {
    const searchRes = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}&x_cg_demo_api_key=${apiKey}`,
    )
    if (!searchRes.ok) {
      return NextResponse.json(
        { error: { code: 'BROKER_UNAVAILABLE', message: 'CoinGecko search unavailable' } },
        { status: 503 },
      )
    }
    const searchData = await searchRes.json()
    coins = searchData.coins ?? []
  } catch {
    return NextResponse.json(
      { error: { code: 'BROKER_UNAVAILABLE', message: 'CoinGecko search unavailable' } },
      { status: 503 },
    )
  }

  const top5 = coins.slice(0, 5)
  if (top5.length === 0) {
    return NextResponse.json([])
  }

  const ids = top5.map((c) => c.id).join(',')
  let priceMap: Record<string, { usd: number }> = {}
  try {
    const priceRes = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&x_cg_demo_api_key=${apiKey}`,
    )
    if (priceRes.ok) {
      priceMap = await priceRes.json()
    }
  } catch {
    // leave priceMap empty
  }

  const rawResults = top5.map((coin) => ({
    ticker: coin.symbol.toUpperCase(),
    name: coin.name,
    asset_type: 'crypto',
    price_source: 'coingecko',
    coingecko_id: coin.id,
    current_price: priceMap[coin.id]?.usd != null
      ? priceMap[coin.id].usd.toFixed(8)
      : '0.00000000',
  }))

  const idMap = await lookupAssetIds(supabase, rawResults.map((r) => r.ticker))
  const results = rawResults.map((r) => ({ ...r, id: idMap.get(r.ticker) ?? null }))

  return NextResponse.json(results)
}
