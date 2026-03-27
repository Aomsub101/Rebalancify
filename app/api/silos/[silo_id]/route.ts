import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildSiloResponse } from '@/lib/silos'

type RouteContext = { params: Promise<{ silo_id: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  const supabase = await createClient()
  const { silo_id } = await params

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })
  }

  // Verify ownership via RLS — only the owner's silo is returned
  const { data: existing, error: fetchError } = await supabase
    .from('silos')
    .select('*')
    .eq('id', silo_id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Silo not found' } }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Invalid request body' } }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if ('name' in body && typeof body.name === 'string' && body.name.trim() !== '') {
    updates.name = body.name.trim()
  }
  if ('base_currency' in body && typeof body.base_currency === 'string' && body.base_currency.length === 3) {
    updates.base_currency = (body.base_currency as string).toUpperCase()
  }
  if ('drift_threshold' in body && typeof body.drift_threshold === 'number') {
    updates.drift_threshold = body.drift_threshold
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: { code: 'NO_FIELDS', message: 'No updatable fields provided' } }, { status: 400 })
  }

  updates.updated_at = new Date().toISOString()

  const { data: updated, error: updateError } = await supabase
    .from('silos')
    .update(updates)
    .eq('id', silo_id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (updateError || !updated) {
    return NextResponse.json({ error: { code: 'UPDATE_FAILED', message: updateError?.message ?? 'Update failed' } }, { status: 500 })
  }

  const { count } = await supabase
    .from('silos')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_active', true)

  return NextResponse.json(buildSiloResponse(updated, count ?? 0, 5))
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const supabase = await createClient()
  const { silo_id } = await params

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })
  }

  // Verify ownership before soft-delete
  const { data: existing, error: fetchError } = await supabase
    .from('silos')
    .select('id')
    .eq('id', silo_id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Silo not found' } }, { status: 404 })
  }

  // Soft delete — sets is_active = FALSE, data is preserved (CLAUDE.md Rule 8 + schema.md)
  const { error: updateError } = await supabase
    .from('silos')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', silo_id)
    .eq('user_id', user.id)

  if (updateError) {
    return NextResponse.json({ error: { code: 'DELETE_FAILED', message: updateError.message } }, { status: 500 })
  }

  return NextResponse.json({ deleted: true, silo_id })
}
