import { NextRequest, NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { createClient } from '@/lib/supabase/server'
import { computeDriftState } from '@/lib/drift'
import { fetchPrice } from '@/lib/priceService'

type Params = Promise<{ silo_id: string }>

function unauthorized() {
  return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 })
}

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return unauthorized()

  const { silo_id } = await params

  // 1. Verify silo ownership
  const { data: silo } = await supabase
    .from('silos')
    .select('id, drift_threshold, platform_type')
    .eq('id', silo_id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!silo) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Silo not found' } }, { status: 404 })
  }

  // 2. Fetch holdings with assets joined
  const { data: holdingsData, error: holdingsError } = await supabase
    .from('holdings')
    .select('id, asset_id, quantity, cost_basis, cash_balance, source, last_updated_at, acquired_at, assets(ticker, name, asset_type, price_source)')
    .eq('silo_id', silo_id)

  if (holdingsError) {
    return NextResponse.json({ error: { code: 'FETCH_FAILED', message: holdingsError.message } }, { status: 500 })
  }

  const rows = holdingsData ?? []
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
  const priceMap = new Map((priceData ?? []).map(p => [p.asset_id, p.price as string]))
  const targetMap = new Map((weightData ?? []).map(tw => [tw.asset_id, Number(tw.weight_pct)]))

  // Fetch prices for uncached assets on-demand (Bug fix: uncached assets defaulted to 0)
  const assetInfoMap = new Map(rows.map(h => {
    const asset = h.assets as unknown as { ticker: string; name: string; asset_type: string; price_source: string }
    return [h.asset_id, asset]
  }))

  const uncachedAssetIds = assetIds.filter(id => !priceMap.has(id))
  await Promise.all(uncachedAssetIds.map(async (assetId) => {
    const asset = assetInfoMap.get(assetId)
    if (!asset) return
    // Resolve price_source: alpaca → finnhub, bitkub → coingecko
    const resolvedSource = asset.price_source === 'alpaca' ? 'finnhub'
      : asset.price_source === 'bitkub' ? 'coingecko'
      : asset.price_source
    try {
      const result = await fetchPrice(supabase, assetId, asset.ticker, resolvedSource as 'finnhub' | 'coingecko')
      priceMap.set(assetId, result.price)
    } catch {
      // non-fatal: leave priceMap entry missing; holdings calculation will use '0'
    }
  }))

  // Compute totals using Decimal to avoid float arithmetic (CLAUDE.md Rule 3)
  const cashBalance = rows.reduce((sum, h) =>
    sum.plus(new Decimal(h.cash_balance as string ?? '0')),
    new Decimal(0)
  )
  const holdingsValue = rows.reduce((sum, h) => {
    const price = new Decimal(priceMap.get(h.asset_id) ?? '0')
    return sum.plus(new Decimal(h.quantity as string).mul(price))
  }, new Decimal(0))
  const totalValue = holdingsValue.plus(cashBalance)

  // Compute per-holding derived values
  const now = Date.now()
  const holdings = rows.map(h => {
    const asset = h.assets as unknown as { ticker: string; name: string; asset_type: string }
    const price = new Decimal(priceMap.get(h.asset_id) ?? '0')
    const qty = new Decimal(h.quantity as string)
    const currentValue = qty.mul(price)
    const currentWeightPct = totalValue.gt(0)
      ? currentValue.div(totalValue).mul(100)
      : new Decimal(0)
    const targetWeightPct = new Decimal(targetMap.get(h.asset_id) ?? 0)
    const driftPct = currentWeightPct.minus(targetWeightPct)
    const driftPctNum = parseFloat(driftPct.toFixed(3))
    const staleDays = Math.floor((now - new Date(h.last_updated_at as string).getTime()) / 86_400_000)
    // Age: days since the asset was first acquired (or re-acquired after a sell-out)
    // acquired_at may be NULL for holdings with quantity = 0 (never acquired)
    const acquiredAt = (h as unknown as { acquired_at?: string | null }).acquired_at
    const ageMs = acquiredAt ? now - new Date(acquiredAt).getTime() : 0
    const ageDays = ageMs > 0 ? Math.floor(ageMs / 86_400_000) : 0

    return {
      id: h.id,
      asset_id: h.asset_id,
      ticker: asset.ticker,
      name: asset.name,
      asset_type: asset.asset_type,
      quantity: h.quantity,
      cost_basis: h.cost_basis,
      current_price: priceMap.get(h.asset_id) ?? '0.00000000',
      current_value: currentValue.toFixed(8),
      current_weight_pct: parseFloat(currentWeightPct.toFixed(3)),
      target_weight_pct: parseFloat(targetWeightPct.toFixed(3)),
      drift_pct: driftPctNum,
      drift_state: computeDriftState(driftPctNum, Number(silo.drift_threshold)),
      drift_breached: driftPct.abs().gt(new Decimal(silo.drift_threshold)),
      source: h.source,
      stale_days: staleDays,
      age_days: ageDays,
      last_updated_at: h.last_updated_at,
    }
  })

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

  let body: { asset_id?: string; quantity?: string; cost_basis?: string; cash_balance?: string; [key: string]: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON' } }, { status: 400 })
  }

  const { asset_id, quantity, cost_basis, cash_balance } = body
  if (!asset_id) {
    return NextResponse.json({ error: { code: 'INVALID_VALUE', message: 'asset_id is required' } }, { status: 400 })
  }
  if (quantity !== undefined && (isNaN(Number(quantity)) || Number(quantity) < 0)) {
    return NextResponse.json({ error: { code: 'INVALID_VALUE', message: 'quantity must be a non-negative number' } }, { status: 400 })
  }

  // Check if this asset was previously held and what its quantity was (for acquired_at logic)
  const { data: existingHolding } = await supabase
    .from('holdings')
    .select('quantity, acquired_at')
    .eq('silo_id', silo_id)
    .eq('asset_id', asset_id)
    .single()

  const newQty = quantity ?? '0.00000000'
  const prevQty = existingHolding?.quantity ?? '0'
  const prevQtyNum = new Decimal(prevQty)
  const newQtyNum = new Decimal(newQty)
  // Set acquired_at when quantity first goes from 0 to >0 (new acquisition or re-buy after sell-out)
  const shouldSetAcquiredAt = newQtyNum.gt(0) && prevQtyNum.lte(0)

  // Note: 'price' field is intentionally ignored — never stored in holdings
  const { data: holding, error: upsertError } = await supabase
    .from('holdings')
    .upsert(
      {
        silo_id,
        asset_id,
        quantity: newQty,
        cost_basis: cost_basis ?? null,
        cash_balance: cash_balance ?? '0.00000000',
        source: 'manual',
        last_updated_at: new Date().toISOString(),
        // Set acquired_at on first acquisition (when qty goes from 0 to >0)
        ...(shouldSetAcquiredAt ? { acquired_at: new Date().toISOString() } : {}),
      },
      { onConflict: 'silo_id,asset_id' }
    )
    .select('id, asset_id, silo_id, quantity, cost_basis, cash_balance, source, last_updated_at, acquired_at')
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
