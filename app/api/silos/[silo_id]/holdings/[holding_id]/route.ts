import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = Promise<{ silo_id: string; holding_id: string }>

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 })
  }

  const { silo_id, holding_id } = await params

  let body: { quantity?: string; cost_basis?: string; cash_balance?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON' } }, { status: 400 })
  }

  const updates: Record<string, string | null> = {
    last_updated_at: new Date().toISOString(),
  }
  if (body.quantity !== undefined) updates.quantity = body.quantity
  if (body.cost_basis !== undefined) updates.cost_basis = body.cost_basis
  if (body.cash_balance !== undefined) updates.cash_balance = body.cash_balance

  // RLS + silo guard: update only if holding belongs to this silo (RLS blocks other users' silos)
  const { data: holding } = await supabase
    .from('holdings')
    .update(updates)
    .eq('id', holding_id)
    .eq('silo_id', silo_id)
    .select('id, asset_id, silo_id, quantity, cost_basis, cash_balance, source, last_updated_at')
    .single()

  if (!holding) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Holding not found' } }, { status: 404 })
  }

  return NextResponse.json(holding)
}
