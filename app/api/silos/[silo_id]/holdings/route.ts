import { NextRequest, NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { createClient } from '@/lib/supabase/server'
import { computeDriftState } from '@/lib/drift'
import { fetchPrice } from '@/lib/priceService'
import { cashCurrencyForPlatform, convertAmount } from '@/lib/currency'
import { ensureFxRates } from '@/lib/fxRates'

type Params = Promise<{ silo_id: string }>

function unauthorized() {
  return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 })
}

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return unauthorized()

  const { silo_id } = await params

  // 1. Verify silo ownership + fetch cash_balance
  const { data: silo } = await supabase
    .from('silos')
    .select('id, drift_threshold, platform_type, cash_balance, base_currency')
    .eq('id', silo_id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!silo) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Silo not found' } }, { status: 404 })
  }

  // 2. Fetch holdings with assets joined (include price_source for on-demand price fetching;
  //     also include created_at for simulation button age check — STORY-042)
  const { data: holdingsData, error: holdingsError } = await supabase
    .from('holdings')
    .select('id, asset_id, quantity, source, last_updated_at, assets(ticker, name, asset_type, price_source, created_at, market_debut_date)')
    .eq('silo_id', silo_id)

  if (holdingsError) {
    return NextResponse.json({ error: { code: 'FETCH_FAILED', message: holdingsError.message } }, { status: 500 })
  }

  let rows = holdingsData ?? []

  // Step 3: Enforce platform isolation for API silos
  // Manual silos show all holdings; API silos show only holdings from that platform's sync source
  if (silo.platform_type !== 'manual') {
    const platformSource = `${silo.platform_type}_sync`
    rows = rows.filter(h => h.source === platformSource)
  }

  const assetIds = rows.map(h => h.asset_id)

  // 3. Fetch prices (public read — no user filter)
  const { data: priceData } = await supabase
    .from('price_cache')
    .select('asset_id, price, currency')
    .in('asset_id', assetIds.length > 0 ? assetIds : ['00000000-0000-0000-0000-000000000000'])

  // 4. Fetch target weights
  const { data: weightData } = await supabase
    .from('target_weights')
    .select('asset_id, weight_pct')
    .eq('silo_id', silo_id)

  // Build lookup maps
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

  // On-demand price fetch for uncached assets — prevents $0.00 values when sync failed to cache
  // (non-fatal: missing prices default to 0, same as before, but now we attempt to fill the gap)
  const uncachedIds = rows.filter((row) => {
    const quote = priceMap.get(row.asset_id)
    return !quote || quote.price === '0'
  }).map((row) => row.asset_id)
  for (const assetId of uncachedIds) {
    const h = rowByAssetId.get(assetId)
    if (!h) continue
    const asset = h.assets as unknown as { ticker: string; name: string; asset_type: string; price_source: string }
    try {
      const priceSource = (asset.price_source ?? 'finnhub') as 'finnhub' | 'coingecko' | 'alpaca' | 'bitkub'
      const result = await fetchPrice(supabase, assetId, asset.ticker, priceSource)
      priceMap.set(assetId, { price: result.price, currency: result.currency ?? 'USD' })
      currencies.add(result.currency ?? 'USD')
      // Persist so subsequent requests hit the cache
      await supabase.from('price_cache').upsert(
        { asset_id: assetId, price: result.price, currency: result.currency ?? 'USD', source: result.source },
        { onConflict: 'asset_id' },
      )
    } catch {
      // non-fatal — price remains 0
    }
  }

  const fxRateData = await ensureFxRates(supabase, Array.from(currencies))
  const rateToUsdMap: Record<string, string | number> = { USD: 1 }
  for (const [currency, row] of Object.entries(fxRateData)) {
    rateToUsdMap[currency] = row.rate_to_usd
  }

  // Compute totals using Decimal to avoid float arithmetic (CLAUDE.md Rule 3)
  // cash_balance now comes from the silos table (post-migration 23), not per-holding sums
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

  // Compute per-holding derived values
  const now = Date.now()
  const holdings = rows.map(h => {
    const asset = h.assets as unknown as { ticker: string; name: string; asset_type: string; created_at?: string; market_debut_date?: string | null }
    const quote = priceMap.get(h.asset_id)
    const price = convertAmount(quote?.price ?? '0', quote?.currency ?? 'USD', silo.base_currency, rateToUsdMap)
    const qty = new Decimal(h.quantity as string)
    const currentValue = qty.mul(price)
    const currentWeightPct = totalValue.gt(0)
      ? currentValue.div(totalValue).mul(100)
      : new Decimal(0)
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
      // Used by SimulateScenariosButton age check (STORY-042 / F11-R1)
      asset_created_at: asset.created_at,
      // Market debut from yfinance 5yr series — used for 3-month simulation constraint
      market_debut_date: asset.market_debut_date ?? null,
    }
  })

  // Backfill market_debut_date for any asset that doesn't have it yet.
  // This fires yfinance to get the 5yr price series and records the earliest date —
  // same logic as api/optimize.py. Only touches tickers that are actually in this silo
  // and only fires for assets with NULL market_debut_date (no-op if already set).
  const nullDebutHoldings = holdings.filter(h => h.market_debut_date === null)
  if (nullDebutHoldings.length > 0) {
    // Deduplicate by ticker — one backfill call per unique ticker
    const tickerSet = new Set(nullDebutHoldings.map(h => h.ticker))
    const backfillPromises = Array.from(tickerSet).map(async ticker => {
      try {
        const res = await fetch(`${_request.nextUrl.origin}/api/backfill_debut`, {
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
    // Mutate the holdings in-place so the response includes the freshly-backfilled dates
    // and the UI can enable the Simulate button without a page reload.
    for (const h of holdings) {
      if (h.market_debut_date === null && backfillMap.has(h.ticker)) {
        h.market_debut_date = backfillMap.get(h.ticker) ?? null
      }
    }
  }

  return NextResponse.json({
    drift_threshold: Number(silo.drift_threshold),
    cash_balance: cashBalance.toFixed(8),
    total_value: totalValue.toFixed(8),
    holdings,
  })
}

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return unauthorized()

  const { silo_id } = await params

  // Verify silo ownership
  const { data: silo } = await supabase
    .from('silos')
    .select('id, platform_type')
    .eq('id', silo_id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!silo) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Silo not found' } }, { status: 404 })
  }

  let body: { asset_id?: string; quantity?: string; [key: string]: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON' } }, { status: 400 })
  }

  const { asset_id, quantity } = body
  if (!asset_id) {
    return NextResponse.json({ error: { code: 'INVALID_VALUE', message: 'asset_id is required' } }, { status: 400 })
  }
  if (quantity !== undefined && (isNaN(Number(quantity)) || Number(quantity) < 0)) {
    return NextResponse.json({ error: { code: 'INVALID_VALUE', message: 'quantity must be a non-negative number' } }, { status: 400 })
  }

  const newQty = quantity ?? '0.00000000'

  // Note: 'price' field is intentionally ignored — never stored in holdings
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
    return NextResponse.json({ error: { code: 'INSERT_FAILED', message: 'Failed to create holding' } }, { status: 500 })
  }

  // Fetch and cache price for newly created manual holding (Bug fix: uncached assets defaulted to 0)
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
        // non-fatal: price will be fetched on next holdings request
      }
    }
  }

  return NextResponse.json(holding, { status: 201 })
}
