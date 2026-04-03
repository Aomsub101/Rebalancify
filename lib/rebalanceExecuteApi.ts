import { NextResponse } from 'next/server'
import type { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/encryption'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>
type RouteResult<T> = { ok: true; data: T; status?: number } | { ok: false; response: Response }

const ALPACA_PAPER_URL = 'https://paper-api.alpaca.markets'
const ALPACA_LIVE_URL = 'https://api.alpaca.markets'

interface ExecuteRequest {
  session_id: string
  approved_order_ids: string[]
  skipped_order_ids: string[]
}

interface AlpacaOrderRequest {
  symbol: string
  qty: string
  side: 'buy' | 'sell'
  type: 'market'
  time_in_force: 'day'
}

interface AlpacaOrderResponse {
  id: string
}

async function postAlpacaOrder(
  baseUrl: string,
  keyId: string,
  secretKey: string,
  order: AlpacaOrderRequest,
): Promise<{ ok: true; alpaca_order_id: string } | { ok: false }> {
  try {
    const res = await fetch(`${baseUrl}/v2/orders`, {
      method: 'POST',
      headers: {
        'APCA-API-KEY-ID': keyId,
        'APCA-API-SECRET-KEY': secretKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(order),
      cache: 'no-store',
    })
    if (!res.ok) return { ok: false }
    const data = (await res.json()) as AlpacaOrderResponse
    return { ok: true, alpaca_order_id: data.id }
  } catch {
    return { ok: false }
  }
}

export async function executeRebalanceResponse(
  request: Request,
  supabase: SupabaseClient,
  userId: string,
  siloId: string,
): Promise<RouteResult<unknown>> {
  let body: ExecuteRequest
  try {
    body = await request.json()
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: 'INVALID_BODY', message: 'Request body must be valid JSON' } },
        { status: 400 },
      ),
    }
  }

  const { session_id, approved_order_ids = [], skipped_order_ids = [] } = body
  if (!session_id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: 'MISSING_SESSION_ID', message: 'session_id is required' } },
        { status: 400 },
      ),
    }
  }

  const { data: silo } = await supabase
    .from('silos')
    .select('id, platform_type, user_id')
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

  const { data: session } = await supabase
    .from('rebalance_sessions')
    .select('id, silo_id, user_id, status')
    .eq('id', session_id)
    .eq('silo_id', siloId)
    .eq('user_id', userId)
    .single()

  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: 'SESSION_NOT_FOUND', message: 'Rebalancing session not found' } },
        { status: 404 },
      ),
    }
  }

  const { data: ordersData, error: ordersError } = await supabase
    .from('rebalance_orders')
    .select('id, order_type, quantity, asset_id, execution_status')
    .eq('session_id', session_id)

  if (ordersError) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: 'FETCH_FAILED', message: ordersError.message } },
        { status: 500 },
      ),
    }
  }

  const orders = (ordersData ?? []) as Array<{
    id: string
    order_type: 'buy' | 'sell'
    quantity: string
    asset_id: string
    execution_status: string
  }>

  const approvedSet = new Set(approved_order_ids)
  const skippedSet = new Set(skipped_order_ids)

  if (skippedSet.size > 0) {
    await supabase
      .from('rebalance_orders')
      .update({ execution_status: 'skipped' })
      .in('id', [...skippedSet])
      .eq('session_id', session_id)
  }

  const orderResults = new Map<string, { execution_status: string; alpaca_order_id?: string }>()
  for (const id of skippedSet) {
    orderResults.set(id, { execution_status: 'skipped' })
  }

  let executedCount = 0
  let failedCount = 0

  if (approvedSet.size === 0) {
    await supabase
      .from('rebalance_sessions')
      .update({ status: 'cancelled' })
      .eq('id', session_id)
      .eq('user_id', userId)

    return {
      ok: true,
      data: {
        session_id,
        executed_count: 0,
        skipped_count: skippedSet.size,
        failed_count: 0,
        orders: orders.map(o => ({
          id: o.id,
          execution_status: orderResults.get(o.id)?.execution_status ?? o.execution_status,
        })),
      },
    }
  }

  if (silo.platform_type === 'alpaca') {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('alpaca_key_enc, alpaca_secret_enc, alpaca_mode')
      .eq('id', userId)
      .single()

    if (!profile?.alpaca_key_enc || !profile?.alpaca_secret_enc) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: { code: 'ALPACA_NOT_CONNECTED', message: 'Alpaca API key not configured' } },
          { status: 403 },
        ),
      }
    }

    const encKey = process.env.ENCRYPTION_KEY
    if (!encKey) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: { code: 'ENCRYPTION_KEY_MISSING', message: 'Server encryption key not configured' } },
          { status: 500 },
        ),
      }
    }

    let alpacaKey: string
    let alpacaSecret: string
    try {
      alpacaKey = decrypt(profile.alpaca_key_enc, encKey)
      alpacaSecret = decrypt(profile.alpaca_secret_enc, encKey)
    } catch {
      return {
        ok: false,
        response: NextResponse.json(
          { error: { code: 'DECRYPTION_FAILED', message: 'Failed to decrypt Alpaca credentials' } },
          { status: 500 },
        ),
      }
    }

    const baseUrl = profile.alpaca_mode === 'live' ? ALPACA_LIVE_URL : ALPACA_PAPER_URL
    const approvedOrders = orders.filter(o => approvedSet.has(o.id))
    const approvedAssetIds = [...new Set(approvedOrders.map(o => o.asset_id))]

    const { data: assetsData } = await supabase
      .from('assets')
      .select('id, ticker')
      .in('id', approvedAssetIds.length > 0 ? approvedAssetIds : ['00000000-0000-0000-0000-000000000000'])

    const tickerMap = new Map<string, string>(
      ((assetsData ?? []) as Array<{ id: string; ticker: string }>).map(a => [a.id, a.ticker]),
    )
    const executedAt = new Date().toISOString()

    for (const order of approvedOrders) {
      const ticker = tickerMap.get(order.asset_id) ?? order.asset_id
      const result = await postAlpacaOrder(baseUrl, alpacaKey, alpacaSecret, {
        symbol: ticker,
        qty: order.quantity,
        side: order.order_type,
        type: 'market',
        time_in_force: 'day',
      })

      if (result.ok) {
        await supabase
          .from('rebalance_orders')
          .update({
            execution_status: 'executed',
            alpaca_order_id: result.alpaca_order_id,
            executed_at: executedAt,
          })
          .eq('id', order.id)
          .eq('session_id', session_id)

        orderResults.set(order.id, {
          execution_status: 'executed',
          alpaca_order_id: result.alpaca_order_id,
        })
        executedCount++
      } else {
        await supabase
          .from('rebalance_orders')
          .update({ execution_status: 'failed' })
          .eq('id', order.id)
          .eq('session_id', session_id)

        orderResults.set(order.id, { execution_status: 'failed' })
        failedCount++
      }
    }

    await supabase
      .from('rebalance_sessions')
      .update({
        status: failedCount > 0 ? 'partial' : 'approved',
        snapshot_after: { executed_at: executedAt },
      })
      .eq('id', session_id)
      .eq('user_id', userId)
  } else {
    const approvedOrders = orders.filter(o => approvedSet.has(o.id))
    if (approvedOrders.length > 0) {
      await supabase
        .from('rebalance_orders')
        .update({ execution_status: 'manual' })
        .in('id', approvedOrders.map(o => o.id))
        .eq('session_id', session_id)
    }

    for (const order of approvedOrders) {
      orderResults.set(order.id, { execution_status: 'manual' })
    }

    await supabase
      .from('rebalance_sessions')
      .update({ status: 'approved' })
      .eq('id', session_id)
      .eq('user_id', userId)
  }

  return {
    ok: true,
    data: {
      session_id,
      executed_count: executedCount,
      skipped_count: skippedSet.size,
      failed_count: failedCount,
      orders: orders.map(o => ({
        id: o.id,
        execution_status: orderResults.get(o.id)?.execution_status ?? o.execution_status,
      })),
    },
  }
}
