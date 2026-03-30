/**
 * POST /api/silos/:silo_id/rebalance/calculate
 *
 * Fetches silo holdings + prices + target weights from Supabase,
 * calls the pure calculateRebalance engine, then persists:
 *   - one rebalance_sessions row (status: 'pending')
 *   - one rebalance_orders row per order
 *
 * Returns the full session + orders response per the API contract.
 *
 * STORY-010 implements: partial mode
 * STORY-010b implements: full mode, pre-flight 422, cash injection tests
 *
 * AC1:  session_id, balance_valid, orders[], snapshot_before, all fields
 * AC2:  partial mode — buy orders never exceed available cash
 * AC5:  silo isolation — engine is a pure function scoped to this silo's data
 * AC7:  weights ≠ 100 proceeds normally
 * AC8:  no orders when all at target
 * AC9:  rebalance_sessions row created (status: 'pending'), no updated_at
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateRebalance, EngineHolding, EngineWeight } from '@/lib/rebalanceEngine'

type Params = Promise<{ silo_id: string }>

interface CalcRequest {
  mode?: 'partial' | 'full'
  include_cash?: boolean
  cash_amount?: string
}

function unauthorized() {
  return NextResponse.json(
    { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
    { status: 401 },
  )
}

function notFound() {
  return NextResponse.json(
    { error: { code: 'NOT_FOUND', message: 'Silo not found' } },
    { status: 404 },
  )
}

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return unauthorized()

  const { silo_id } = await params

  // -------------------------------------------------------------------------
  // Parse and validate request body
  // -------------------------------------------------------------------------

  let body: CalcRequest = {}
  try {
    body = await request.json()
  } catch {
    // Empty body is acceptable — all fields have defaults
  }

  const mode = body.mode ?? 'partial'
  const include_cash = body.include_cash ?? false
  const cash_amount = body.cash_amount ?? '0.00000000'

  if (mode !== 'partial' && mode !== 'full') {
    return NextResponse.json(
      { error: { code: 'INVALID_MODE', message: "mode must be 'partial' or 'full'" } },
      { status: 400 },
    )
  }

  // -------------------------------------------------------------------------
  // Verify silo ownership (RLS double-check)
  // -------------------------------------------------------------------------

  const { data: silo } = await supabase
    .from('silos')
    .select('id, user_id')
    .eq('id', silo_id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!silo) return notFound()

  // -------------------------------------------------------------------------
  // Fetch holdings + joined asset info
  // -------------------------------------------------------------------------

  const { data: holdingsData, error: holdingsError } = await supabase
    .from('holdings')
    .select('asset_id, quantity, cash_balance, assets(ticker)')
    .eq('silo_id', silo_id)

  if (holdingsError) {
    return NextResponse.json(
      { error: { code: 'FETCH_FAILED', message: holdingsError.message } },
      { status: 500 },
    )
  }

  const holdingsRows = (holdingsData ?? []) as unknown as Array<{
    asset_id: string
    quantity: string
    cash_balance: string
    assets: { ticker: string }
  }>

  const assetIds = holdingsRows.map(h => h.asset_id)

  // -------------------------------------------------------------------------
  // Fetch prices
  // -------------------------------------------------------------------------

  const { data: priceData } = await supabase
    .from('price_cache')
    .select('asset_id, price')
    .in('asset_id', assetIds.length > 0 ? assetIds : ['00000000-0000-0000-0000-000000000000'])

  const priceMap = new Map<string, string>(
    (priceData ?? []).map(p => [p.asset_id, String(p.price)]),
  )

  // -------------------------------------------------------------------------
  // Fetch target weights
  // -------------------------------------------------------------------------

  const { data: weightData, error: weightError } = await supabase
    .from('target_weights')
    .select('asset_id, weight_pct')
    .eq('silo_id', silo_id)

  if (weightError) {
    return NextResponse.json(
      { error: { code: 'FETCH_FAILED', message: weightError.message } },
      { status: 500 },
    )
  }

  const weightRows = (weightData ?? []) as Array<{ asset_id: string; weight_pct: string }>

  // -------------------------------------------------------------------------
  // Build engine input (skip holdings with no price data)
  // -------------------------------------------------------------------------

  const engineHoldings: EngineHolding[] = holdingsRows
    .map(h => ({
      asset_id: h.asset_id,
      ticker: h.assets.ticker,
      quantity: String(h.quantity),
      cash_balance: String(h.cash_balance),
      price: priceMap.get(h.asset_id) ?? '0',
    }))

  const engineWeights: EngineWeight[] = weightRows.map(w => ({
    asset_id: w.asset_id,
    weight_pct: String(w.weight_pct),
  }))

  // -------------------------------------------------------------------------
  // Run the pure calculation engine
  // -------------------------------------------------------------------------

  const result = calculateRebalance({
    holdings: engineHoldings,
    weights: engineWeights,
    mode,
    include_cash,
    cash_amount,
  })

  // -------------------------------------------------------------------------
  // Pre-flight: full mode — return 422 without creating DB records (AC2)
  // -------------------------------------------------------------------------

  if (!result.balance_valid) {
    return NextResponse.json(
      {
        session_id: null,
        mode,
        balance_valid: false,
        balance_errors: result.balance_errors,
        weights_sum_pct: result.weights_sum_pct,
        cash_target_pct: result.cash_target_pct,
        snapshot_before: result.snapshot_before,
        orders: result.orders,
      },
      { status: 422 },
    )
  }

  // -------------------------------------------------------------------------
  // Persist rebalance_sessions (immutable — no updated_at, CLAUDE.md Rule 9)
  // -------------------------------------------------------------------------

  const { data: sessionRow, error: sessionError } = await supabase
    .from('rebalance_sessions')
    .insert({
      silo_id,
      user_id: user.id,
      mode,
      cash_included: include_cash,
      cash_amount: include_cash ? cash_amount : null,
      weights_sum_pct: result.weights_sum_pct.toFixed(3),
      cash_target_pct: result.cash_target_pct.toFixed(3),
      snapshot_before: result.snapshot_before,
      status: 'pending',
      created_at: new Date().toISOString(),
      // NEVER add updated_at — sessions are immutable (CLAUDE.md Rule 9, F1-R10)
    })
    .select('id')
    .single()

  if (sessionError || !sessionRow) {
    return NextResponse.json(
      { error: { code: 'SESSION_CREATE_FAILED', message: sessionError?.message ?? 'Failed to create session' } },
      { status: 500 },
    )
  }

  const sessionId: string = sessionRow.id

  // -------------------------------------------------------------------------
  // Persist rebalance_orders (one row per order)
  // -------------------------------------------------------------------------

  if (result.orders.length > 0) {
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
      return NextResponse.json(
        { error: { code: 'ORDERS_CREATE_FAILED', message: ordersError.message } },
        { status: 500 },
      )
    }

    // Build ticker map for the order response
    const tickerMap = new Map<string, string>(
      engineHoldings.map(h => [h.asset_id, h.ticker])
    )
    // Include tickers for weight-only assets (no current holding)
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

    return NextResponse.json({
      session_id: sessionId,
      mode,
      balance_valid: result.balance_valid,
      balance_errors: result.balance_errors,
      weights_sum_pct: result.weights_sum_pct,
      cash_target_pct: result.cash_target_pct,
      snapshot_before: result.snapshot_before,
      orders: ordersWithTicker,
    })
  }

  // No orders case (all at target — AC8)
  return NextResponse.json({
    session_id: sessionId,
    mode,
    balance_valid: true,
    balance_errors: [],
    weights_sum_pct: result.weights_sum_pct,
    cash_target_pct: result.cash_target_pct,
    snapshot_before: result.snapshot_before,
    orders: [],
  })
}
