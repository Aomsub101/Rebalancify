import type { SupabaseClient } from '@supabase/supabase-js'

export interface PriceResult {
  price: string      // 8dp string e.g. "185.20000000"
  currency: string   // 'USD'
  source: string
  fromCache: boolean
}

export async function fetchPrice(
  supabase: SupabaseClient,
  assetId: string,
  ticker: string,
  source: 'finnhub' | 'coingecko' | 'alpaca' | 'bitkub',
  coingeckoId?: string
): Promise<PriceResult> {
  // Resolve actual price source — 'alpaca' stocks go through Finnhub, 'bitkub' goes through CoinGecko
  const actualSource: 'finnhub' | 'coingecko' =
    source === 'alpaca' ? 'finnhub' :
    source === 'bitkub' ? 'coingecko' :
    source

  // Tier 1: Check price_cache_fresh view
  const { data: cacheRow } = await supabase
    .from('price_cache_fresh')
    .select('*')
    .eq('asset_id', assetId)
    .single()

  if (cacheRow?.is_fresh) {
    return {
      price: cacheRow.price as string,
      currency: cacheRow.currency as string,
      source: cacheRow.source as string,
      fromCache: true,
    }
  }

  // Tier 2: Fetch from external API
  let price: string
  let currency = 'USD'

  if (actualSource === 'finnhub') {
    const url = `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${process.env.FINNHUB_API_KEY}`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Finnhub quote failed: ${response.status}`)
    }
    const json = await response.json() as { c: number }
    if (json.c === 0) {
      throw new Error(`Finnhub returned zero price for ${ticker}`)
    }
    price = json.c.toFixed(8)
  } else {
    const id = coingeckoId ?? ticker.toLowerCase()
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`CoinGecko price failed: ${response.status}`)
    }
    const json = await response.json() as Record<string, { usd: number }>
    const rawPrice = json[id]?.usd
    if (rawPrice === undefined || rawPrice === 0) {
      throw new Error(`CoinGecko returned zero or missing price for ${id}`)
    }
    price = rawPrice.toFixed(8)
  }

  // Tier 3: Upsert into price_cache — store actualSource so cache reflects the real API used
  await supabase.from('price_cache').upsert({
    asset_id: assetId,
    price,
    currency,
    source: actualSource,
    fetched_at: new Date().toISOString(),
  })

  return {
    price,
    currency,
    source: actualSource,
    fromCache: false,
  }
}
