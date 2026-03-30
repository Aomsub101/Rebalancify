import { NextRequest, NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { createClient } from '@/lib/supabase/server'

type Params = Promise<{ silo_id: string }>

function unauthorized() {
  return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 })
}

/** Build the standard response shape from stored weight rows. */
function buildResponse(rows: { asset_id: string; weight_pct: string; assets: { ticker: string } }[]) {
  const weightsSumPct = rows.reduce(
    (sum, r) => sum.plus(new Decimal(r.weight_pct)),
    new Decimal(0)
  )
  const cashTargetPct = Decimal.max(0, new Decimal(100).minus(weightsSumPct))
  const diff = weightsSumPct.minus(100).abs()
  const sumWarning = rows.length > 0 && diff.gt('0.001')

  return {
    weights_sum_pct: parseFloat(weightsSumPct.toFixed(3)),
    cash_target_pct: parseFloat(cashTargetPct.toFixed(3)),
    sum_warning: sumWarning,
    weights: rows.map(r => ({
      asset_id: r.asset_id,
      ticker: r.assets.ticker,
      weight_pct: parseFloat(new Decimal(r.weight_pct).toFixed(3)),
    })),
  }
}

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return unauthorized()

  const { silo_id } = await params

  // Verify silo ownership (RLS)
  const { data: silo } = await supabase
    .from('silos')
    .select('id')
    .eq('id', silo_id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!silo) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Silo not found' } }, { status: 404 })
  }

  const { data: weightRows, error: weightError } = await supabase
    .from('target_weights')
    .select('asset_id, weight_pct, assets(ticker)')
    .eq('silo_id', silo_id)

  if (weightError) {
    return NextResponse.json({ error: { code: 'FETCH_FAILED', message: weightError.message } }, { status: 500 })
  }

  const rows = (weightRows ?? []) as unknown as { asset_id: string; weight_pct: string; assets: { ticker: string } }[]
  return NextResponse.json(buildResponse(rows))
}

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return unauthorized()

  const { silo_id } = await params

  // Verify silo ownership (RLS)
  const { data: silo } = await supabase
    .from('silos')
    .select('id')
    .eq('id', silo_id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!silo) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Silo not found' } }, { status: 404 })
  }

  let body: { weights?: { asset_id: string; weight_pct: number }[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON' } }, { status: 400 })
  }

  const weights = body.weights ?? []

  // Validate each weight: 0 ≤ weight_pct ≤ 100 (AC2, CLAUDE.md Rule 3)
  let sumPct = new Decimal(0)
  for (const w of weights) {
    const val = new Decimal(w.weight_pct)
    sumPct = sumPct.plus(val)
    if (val.lt(0) || val.gt(100)) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_WEIGHT',
            message: `weight_pct must be between 0 and 100; got ${w.weight_pct} for asset ${w.asset_id}`,
          },
        },
        { status: 422 }
      )
    }
  }

  if (sumPct.gt(100)) {
    return NextResponse.json(
      { error: { code: 'INVALID_WEIGHT_SUM', message: `Total weights sum to ${sumPct.toFixed(3)}% which exceeds 100%` } },
      { status: 422 }
    )
  }

  // Atomic replacement: delete all existing weights then insert new ones
  const { error: deleteError } = await supabase
    .from('target_weights')
    .delete()
    .eq('silo_id', silo_id)

  if (deleteError) {
    return NextResponse.json({ error: { code: 'DELETE_FAILED', message: deleteError.message } }, { status: 500 })
  }

  if (weights.length > 0) {
    const { error: insertError } = await supabase
      .from('target_weights')
      .insert(
        weights.map(w => ({
          silo_id,
          asset_id: w.asset_id,
          weight_pct: new Decimal(w.weight_pct).toFixed(3),
          updated_at: new Date().toISOString(),
        }))
      )

    if (insertError) {
      return NextResponse.json({ error: { code: 'INSERT_FAILED', message: insertError.message } }, { status: 500 })
    }
  }

  // Re-fetch to return canonical response (includes ticker from asset join)
  const { data: updatedRows, error: fetchError } = await supabase
    .from('target_weights')
    .select('asset_id, weight_pct, assets(ticker)')
    .eq('silo_id', silo_id)

  if (fetchError) {
    return NextResponse.json({ error: { code: 'FETCH_FAILED', message: fetchError.message } }, { status: 500 })
  }

  const rows = (updatedRows ?? []) as unknown as { asset_id: string; weight_pct: string; assets: { ticker: string } }[]
  return NextResponse.json(buildResponse(rows))
}
