import { NextResponse } from 'next/server'
import type { createClient } from '@/lib/supabase/server'
import { calculateRebalance, type EngineHolding, type EngineWeight } from '@/lib/rebalanceEngine'
import { fetchPrice } from '@/lib/priceService'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>
type RouteResult<T> = { ok: true; data: T; status?: number } | { ok: false; response: Response }

interface CalcRequest {
  mode?: 'partial' | 'full'
}

export async function calculateRebalanceResponse(
  request: Request,
  supabase: SupabaseClient,
  userId: string,
  siloId: string,
): Promise<RouteResult<unknown>> {
  let body: CalcRequest = {}
  try {
    body = await request.json()
  } catch {
    // Empty body is acceptable.
  }

  const mode = body.mode ?? 'partial'
  if (mode !== 'partial' && mode !== 'full') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: 'INVALID_MODE', message: "mode must be 'partial' or 'full'" } },
        { status: 400 },
      ),
    }
  }

  const { data: silo } = await supabase
    .from('silos')
    .select('id, user_id, cash_balance')
    .eq('id', siloId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (!silo) {
    return {
      ok: false,
      response: NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Silo not found' } }, { status: 404 }),
    }
  }

  const { data: holdingsData, error: holdingsError } = await supabase
    .from('holdings')
    .select('asset_id, quantity, assets(ticker)')
    .eq('silo_id', siloId)

  if (holdingsError) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: 'FETCH_FAILED', message: holdingsError.message } },
        { status: 500 },
      ),
    }
  }

  const { data: weightData, error: weightError } = await supabase
    .from('target_weights')
    .select('asset_id, weight_pct')
    .eq('silo_id', siloId)

  if (weightError) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: 'FETCH_FAILED', message: weightError.message } },
        { status: 500 },
      ),
    }
  }

  const holdingsRows = (holdingsData ?? []) as unknown as Array<{
    asset_id: string
    quantity: string
    assets: { ticker: string }
  }>
  const weightRows = (weightData ?? []) as Array<{ asset_id: string; weight_pct: string }>

  const holdingIds = holdingsRows.map(h => h.asset_id)
  const holdingIdSet = new Set(holdingIds)
  const weightIds = weightRows.map(w => w.asset_id)
  const allAssetIds = [...new Set([...holdingIds, ...weightIds])]

  const { data: priceData } = await supabase
    .from('price_cache')
    .select('asset_id, price')
    .in('asset_id', allAssetIds.length > 0 ? allAssetIds : ['00000000-0000-0000-0000-000000000000'])

  const priceMap = new Map<string, string>(
    (priceData ?? []).map(p => [p.asset_id, String(p.price)]),
  )

  const { data: assetData } = await supabase
    .from('assets')
    .select('id, ticker, price_source')
    .in('id', allAssetIds.length > 0 ? allAssetIds : ['00000000-0000-0000-0000-000000000000'])

  const assetTickerMap = new Map<string, string>(
    (assetData ?? []).map(a => [a.id, a.ticker]),
  )
  const assetSourceMap = new Map<string, string>(
    (assetData ?? []).map(a => [a.id, a.price_source ?? 'finnhub']),
  )

  const missingIds = allAssetIds.filter(id => !priceMap.has(id) || priceMap.get(id) === '0')
  for (const assetId of missingIds) {
    const ticker = assetTickerMap.get(assetId) ?? assetId
    const source = assetSourceMap.get(assetId) ?? 'finnhub'
    try {
      const result = await fetchPrice(
        supabase,
        assetId,
        ticker,
        source as 'finnhub' | 'coingecko',
      )
      priceMap.set(assetId, result.price)
    } catch {
      // non-fatal
    }
  }

  const engineHoldings: EngineHolding[] = holdingsRows.map(h => ({
    asset_id: h.asset_id,
    ticker: h.assets.ticker,
    quantity: String(h.quantity),
    price: priceMap.get(h.asset_id) ?? '0',
  }))

  for (const w of weightRows) {
    if (!holdingIdSet.has(w.asset_id)) {
      engineHoldings.push({
        asset_id: w.asset_id,
        ticker: assetTickerMap.get(w.asset_id) ?? w.asset_id,
        quantity: '0.00000000',
        price: priceMap.get(w.asset_id) ?? '0',
      })
    }
  }

  const engineWeights: EngineWeight[] = weightRows.map(w => ({
    asset_id: w.asset_id,
    weight_pct: String(w.weight_pct),
  }))

  const result = calculateRebalance({
    holdings: engineHoldings,
    weights: engineWeights,
    mode,
    cashBalance: String(silo.cash_balance ?? '0'),
  })

  if (!result.balance_valid) {
    return {
      ok: true,
      status: 422,
      data: {
        session_id: null,
        mode,
        balance_valid: false,
        balance_errors: result.balance_errors,
        weights_sum_pct: result.weights_sum_pct,
        cash_target_pct: result.cash_target_pct,
        snapshot_before: result.snapshot_before,
        orders: result.orders,
      },
    }
  }

  const { data: sessionRow, error: sessionError } = await supabase
    .from('rebalance_sessions')
    .insert({
      silo_id: siloId,
      user_id: userId,
      mode,
      weights_sum_pct: result.weights_sum_pct.toFixed(3),
      cash_target_pct: result.cash_target_pct.toFixed(3),
      snapshot_before: result.snapshot_before,
      status: 'pending',
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (sessionError || !sessionRow) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: 'SESSION_CREATE_FAILED', message: sessionError?.message ?? 'Failed to create session' } },
        { status: 500 },
      ),
    }
  }

  const sessionId: string = sessionRow.id
  if (result.orders.length === 0) {
    return {
      ok: true,
      data: {
        session_id: sessionId,
        mode,
        balance_valid: true,
        balance_errors: [],
        weights_sum_pct: result.weights_sum_pct,
        cash_target_pct: result.cash_target_pct,
        snapshot_before: result.snapshot_before,
        orders: [],
      },
    }
  }

  const orderRows = result.orders.map(o => ({
    session_id: sessionId,
    asset_id: o.asset_id,
    order_type: o.order_type,
    quantity: o.quantity,
    estimated_value: o.estimated_value,
    price_at_calc: o.price_at_calc,
    weight_before_pct: o.weight_before_pct.toFixed(3),
    weight_after_pct: o.weight_after_pct.toFixed(3),
    execution_status: 'pending',
  }))

  const { data: insertedOrders, error: ordersError } = await supabase
    .from('rebalance_orders')
    .insert(orderRows)
    .select('id, asset_id, order_type, quantity, estimated_value, price_at_calc, weight_before_pct, weight_after_pct')

  if (ordersError) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: 'ORDERS_CREATE_FAILED', message: ordersError.message } },
        { status: 500 },
      ),
    }
  }

  const tickerMap = new Map<string, string>(engineHoldings.map(h => [h.asset_id, h.ticker]))
  for (const order of result.orders) {
    if (!tickerMap.has(order.asset_id)) {
      tickerMap.set(order.asset_id, order.ticker)
    }
  }

  const ordersWithTicker = (insertedOrders ?? []).map(o => ({
    id: o.id,
    asset_id: o.asset_id,
    ticker: tickerMap.get(o.asset_id) ?? '',
    order_type: o.order_type,
    quantity: String(o.quantity),
    estimated_value: String(o.estimated_value),
    price_at_calc: String(o.price_at_calc),
    weight_before_pct: parseFloat(String(o.weight_before_pct)),
    weight_after_pct: parseFloat(String(o.weight_after_pct)),
  }))

  return {
    ok: true,
    data: {
      session_id: sessionId,
      mode,
      balance_valid: result.balance_valid,
      balance_errors: result.balance_errors,
      weights_sum_pct: result.weights_sum_pct,
      cash_target_pct: result.cash_target_pct,
      snapshot_before: result.snapshot_before,
      orders: ordersWithTicker,
    },
  }
}
