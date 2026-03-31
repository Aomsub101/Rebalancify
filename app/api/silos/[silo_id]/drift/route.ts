import { NextRequest, NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { createClient } from '@/lib/supabase/server'
import { computeDriftState } from '@/lib/drift'
import { fetchPrice } from '@/lib/priceService'

type Params = Promise<{ silo_id: string }>

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })
  }

  const { silo_id } = await params

  // 1. Verify silo ownership (RLS — AC8)
  const { data: silo } = await supabase
    .from('silos')
    .select('id, drift_threshold, cash_balance')
    .eq('id', silo_id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!silo) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Silo not found' } }, { status: 404 })
  }

  const threshold = Number(silo.drift_threshold)

  // 2. Fetch holdings with asset join
  const { data: holdingsData } = await supabase
    .from('holdings')
    .select('asset_id, quantity, assets(ticker, name, price_source)')
    .eq('silo_id', silo_id)

  const rows = holdingsData ?? []
  const assetIds = rows.map(h => h.asset_id)

  // 3. Fetch latest prices (global read — AC7: live computation, nothing stored)
  const { data: priceData } = await supabase
    .from('price_cache')
    .select('asset_id, price')
    .in('asset_id', assetIds.length > 0 ? assetIds : ['00000000-0000-0000-0000-000000000000'])

  // 4. Fetch target weights
  const { data: weightData } = await supabase
    .from('target_weights')
    .select('asset_id, weight_pct')
    .eq('silo_id', silo_id)

  // Build lookup maps
  const priceMap = new Map((priceData ?? []).map(p => [p.asset_id, p.price as string]))
  const targetMap = new Map((weightData ?? []).map(tw => [tw.asset_id, tw.weight_pct as string]))

  // 4b. On-demand fetch for uncached assets (Bug fix: Alpaca/Webull sync never cached prices)
  const assetInfoMap = new Map(rows.map(h => {
    const asset = h.assets as unknown as { ticker: string; name: string; price_source: string }
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
      // non-fatal: price stays 0
    }
  }))

  // Compute silo total value (holdings value + silo-level cash_balance)
  // post-migration 23: cash_balance is on silos, not per-holding
  const holdingsValue = rows.reduce((sum, h) => {
    const price = new Decimal(priceMap.get(h.asset_id) ?? '0')
    const qty = new Decimal(h.quantity as string)
    return sum.plus(qty.mul(price))
  }, new Decimal(0))
  const totalValue = holdingsValue.plus(new Decimal(silo.cash_balance as string ?? '0'))

  // Compute per-asset drift (AC1, AC2, AC3)
  const assets = rows.map(h => {
    const asset = h.assets as unknown as { ticker: string; name: string }
    const price = new Decimal(priceMap.get(h.asset_id) ?? '0')
    const qty = new Decimal(h.quantity as string)
    const currentValue = qty.mul(price)
    const currentWeightPct = totalValue.gt(0)
      ? currentValue.div(totalValue).mul(100)
      : new Decimal(0)
    const targetWeightPct = new Decimal(targetMap.get(h.asset_id) ?? '0')
    // AC2: drift = current_weight_pct - target_weight_pct
    const driftPct = currentWeightPct.minus(targetWeightPct)
    const driftPctNum = parseFloat(driftPct.toFixed(3))

    // AC3: three-state classification
    const driftState = computeDriftState(driftPctNum, threshold)
    // drift_breached = yellow or red (ABS > threshold)
    const driftBreached = driftPct.abs().gt(new Decimal(threshold))

    return {
      asset_id: h.asset_id,
      ticker: asset.ticker,
      current_weight_pct: parseFloat(currentWeightPct.toFixed(3)),
      target_weight_pct: parseFloat(targetWeightPct.toFixed(3)),
      drift_pct: driftPctNum,       // AC5: signed value
      drift_state: driftState,       // AC1
      drift_breached: driftBreached, // AC1
    }
  })

  return NextResponse.json({
    silo_id,
    drift_threshold: threshold,
    computed_at: new Date().toISOString(), // AC7: always live
    assets,
  })
}
