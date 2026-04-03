import { NextRequest, NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import type { createClient } from '@/lib/supabase/server'
import { computeDriftState } from '@/lib/drift'
import { fetchPrice } from '@/lib/priceService'
import { cashCurrencyForPlatform, convertAmount } from '@/lib/currency'
import { ensureFxRates } from '@/lib/fxRates'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>
type RouteResult<T> = { ok: true; data: T; status?: number } | { ok: false; response: Response }
type Params = Promise<{ silo_id: string }>

function notFoundResponse() {
  return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Silo not found' } }, { status: 404 })
}

async function fetchOwnedSilo(
  supabase: SupabaseClient,
  userId: string,
  siloId: string,
  fields: string,
): Promise<RouteResult<Record<string, unknown>>> {
  const { data: silo } = await supabase
    .from('silos')
    .select(fields)
    .eq('id', siloId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (!silo) {
    return { ok: false, response: notFoundResponse() }
  }

  return { ok: true, data: silo as unknown as Record<string, unknown> }
}

export async function getHoldingsResponse(
  request: NextRequest,
  supabase: SupabaseClient,
  userId: string,
  params: Params,
): Promise<RouteResult<unknown>> {
  const { silo_id } = await params
  const siloResult = await fetchOwnedSilo(
    supabase,
    userId,
    silo_id,
    'id, drift_threshold, platform_type, cash_balance, base_currency',
  )
  if (!siloResult.ok) return siloResult
  const silo = siloResult.data as {
    id: string
    drift_threshold: number
    platform_type: string
    cash_balance: string
    base_currency: string
  }

  const { data: holdingsData, error: holdingsError } = await supabase
    .from('holdings')
    .select('id, asset_id, quantity, source, last_updated_at, assets(ticker, name, asset_type, price_source, created_at, market_debut_date)')
    .eq('silo_id', silo_id)

  if (holdingsError) {
    return {
      ok: false,
      response: NextResponse.json({ error: { code: 'FETCH_FAILED', message: holdingsError.message } }, { status: 500 }),
    }
  }

  let rows = holdingsData ?? []
  if (silo.platform_type !== 'manual') {
    const platformSource = `${silo.platform_type}_sync`
    rows = rows.filter(h => h.source === platformSource)
  }

  const assetIds = rows.map(h => h.asset_id)
  const { data: priceData } = await supabase
    .from('price_cache')
    .select('asset_id, price, currency')
    .in('asset_id', assetIds.length > 0 ? assetIds : ['00000000-0000-0000-0000-000000000000'])

  const { data: weightData } = await supabase
    .from('target_weights')
    .select('asset_id, weight_pct')
    .eq('silo_id', silo_id)

  const priceMap = new Map((priceData ?? []).map(p => [p.asset_id, {
    price: p.price as string,
    currency: (p.currency as string | null) ?? 'USD',
  }]))
  const targetMap = new Map((weightData ?? []).map(tw => [tw.asset_id, Number(tw.weight_pct)]))
  const rowByAssetId = new Map(rows.map((row) => [row.asset_id, row]))
  const currencies = new Set<string>([silo.base_currency, cashCurrencyForPlatform(silo.platform_type, silo.base_currency)])
  for (const row of priceData ?? []) {
    currencies.add((row.currency as string | null) ?? 'USD')
  }

  const uncachedIds = rows
    .filter((row) => {
      const quote = priceMap.get(row.asset_id)
      return !quote || quote.price === '0'
    })
    .map((row) => row.asset_id)

  for (const assetId of uncachedIds) {
    const holding = rowByAssetId.get(assetId)
    if (!holding) continue
    const asset = holding.assets as unknown as { ticker: string; name: string; asset_type: string; price_source: string }
    try {
      const priceSource = (asset.price_source ?? 'finnhub') as 'finnhub' | 'coingecko' | 'alpaca' | 'bitkub'
      const result = await fetchPrice(supabase, assetId, asset.ticker, priceSource)
      priceMap.set(assetId, { price: result.price, currency: result.currency ?? 'USD' })
      currencies.add(result.currency ?? 'USD')
      await supabase.from('price_cache').upsert(
        { asset_id: assetId, price: result.price, currency: result.currency ?? 'USD', source: result.source },
        { onConflict: 'asset_id' },
      )
    } catch {
      // non-fatal
    }
  }

  const fxRateData = await ensureFxRates(supabase, Array.from(currencies))
  const rateToUsdMap: Record<string, string | number> = { USD: 1 }
  for (const [currency, row] of Object.entries(fxRateData)) {
    rateToUsdMap[currency] = row.rate_to_usd
  }

  const cashBalance = convertAmount(
    silo.cash_balance as string ?? '0',
    cashCurrencyForPlatform(silo.platform_type, silo.base_currency),
    silo.base_currency,
    rateToUsdMap,
  )
  const holdingsValue = rows.reduce((sum, h) => {
    const quote = priceMap.get(h.asset_id)
    const nativeValue = new Decimal(h.quantity as string).mul(new Decimal(quote?.price ?? '0'))
    return sum.plus(convertAmount(nativeValue, quote?.currency ?? 'USD', silo.base_currency, rateToUsdMap))
  }, new Decimal(0))
  const totalValue = holdingsValue.plus(cashBalance)

  const now = Date.now()
  const holdings = rows.map(h => {
    const asset = h.assets as unknown as { ticker: string; name: string; asset_type: string; created_at?: string; market_debut_date?: string | null }
    const quote = priceMap.get(h.asset_id)
    const price = convertAmount(quote?.price ?? '0', quote?.currency ?? 'USD', silo.base_currency, rateToUsdMap)
    const qty = new Decimal(h.quantity as string)
    const currentValue = qty.mul(price)
    const currentWeightPct = totalValue.gt(0) ? currentValue.div(totalValue).mul(100) : new Decimal(0)
    const targetWeightPct = new Decimal(targetMap.get(h.asset_id) ?? 0)
    const driftPct = currentWeightPct.minus(targetWeightPct)
    const driftPctNum = parseFloat(driftPct.toFixed(3))
    const staleDays = Math.floor((now - new Date(h.last_updated_at as string).getTime()) / 86_400_000)

    return {
      id: h.id,
      asset_id: h.asset_id,
      ticker: asset.ticker,
      name: asset.name,
      asset_type: asset.asset_type,
      quantity: h.quantity,
      current_price: price.toFixed(8),
      current_value: currentValue.toFixed(8),
      current_weight_pct: parseFloat(currentWeightPct.toFixed(3)),
      target_weight_pct: parseFloat(targetWeightPct.toFixed(3)),
      drift_pct: driftPctNum,
      drift_state: computeDriftState(driftPctNum, Number(silo.drift_threshold)),
      drift_breached: driftPct.abs().gt(new Decimal(silo.drift_threshold)),
      source: h.source,
      stale_days: staleDays,
      last_updated_at: h.last_updated_at,
      asset_created_at: asset.created_at,
      market_debut_date: asset.market_debut_date ?? null,
    }
  })

  const nullDebutHoldings = holdings.filter(h => h.market_debut_date === null)
  if (nullDebutHoldings.length > 0) {
    const tickerSet = new Set(nullDebutHoldings.map(h => h.ticker))
    const backfillPromises = Array.from(tickerSet).map(async ticker => {
      try {
        const res = await fetch(`${request.nextUrl.origin}/api/backfill_debut`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker }),
        })
        if (!res.ok) return { ticker, market_debut_date: null }
        const data = await res.json()
        return { ticker, market_debut_date: data.market_debut_date ?? null }
      } catch {
        return { ticker, market_debut_date: null }
      }
    })
    const results = await Promise.all(backfillPromises)
    const backfillMap = new Map(results.map(r => [r.ticker, r.market_debut_date]))
    for (const holding of holdings) {
      if (holding.market_debut_date === null && backfillMap.has(holding.ticker)) {
        holding.market_debut_date = backfillMap.get(holding.ticker) ?? null
      }
    }
  }

  return {
    ok: true,
    data: {
      drift_threshold: Number(silo.drift_threshold),
      cash_balance: cashBalance.toFixed(8),
      total_value: totalValue.toFixed(8),
      holdings,
    },
  }
}

export async function createHoldingResponse(
  request: NextRequest,
  supabase: SupabaseClient,
  userId: string,
  params: Params,
): Promise<RouteResult<unknown>> {
  const { silo_id } = await params
  const siloResult = await fetchOwnedSilo(
    supabase,
    userId,
    silo_id,
    'id, platform_type',
  )
  if (!siloResult.ok) return siloResult

  let body: { asset_id?: string; quantity?: string; [key: string]: unknown }
  try {
    body = await request.json()
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON' } }, { status: 400 }),
    }
  }

  const { asset_id, quantity } = body
  if (!asset_id) {
    return {
      ok: false,
      response: NextResponse.json({ error: { code: 'INVALID_VALUE', message: 'asset_id is required' } }, { status: 400 }),
    }
  }
  if (quantity !== undefined && (isNaN(Number(quantity)) || Number(quantity) < 0)) {
    return {
      ok: false,
      response: NextResponse.json({ error: { code: 'INVALID_VALUE', message: 'quantity must be a non-negative number' } }, { status: 400 }),
    }
  }

  const newQty = quantity ?? '0.00000000'
  const { data: holding, error: upsertError } = await supabase
    .from('holdings')
    .upsert(
      {
        silo_id,
        asset_id,
        quantity: newQty,
        source: 'manual',
        last_updated_at: new Date().toISOString(),
      },
      { onConflict: 'silo_id,asset_id' }
    )
    .select('id, asset_id, silo_id, quantity, source, last_updated_at')
    .single()

  if (upsertError || !holding) {
    return {
      ok: false,
      response: NextResponse.json({ error: { code: 'INSERT_FAILED', message: 'Failed to create holding' } }, { status: 500 }),
    }
  }

  const { data: assetData } = await supabase
    .from('assets')
    .select('ticker, price_source')
    .eq('id', asset_id)
    .single()

  if (assetData) {
    const { data: existingPrice } = await supabase
      .from('price_cache')
      .select('asset_id')
      .eq('asset_id', asset_id)
      .single()

    if (!existingPrice) {
      const priceSource = assetData.price_source as 'finnhub' | 'coingecko'
      try {
        await fetchPrice(supabase, asset_id, assetData.ticker, priceSource)
      } catch {
        // non-fatal
      }
    }
  }

  return { ok: true, data: holding, status: 201 }
}
