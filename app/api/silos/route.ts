import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkSiloLimit, buildSiloResponse } from '@/lib/silos'

const VALID_PLATFORM_TYPES = ['alpaca', 'bitkub', 'innovestx', 'schwab', 'webull', 'manual'] as const

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })
  }

  const { data: silos, error } = await supabase
    .from('silos')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: { code: 'FETCH_FAILED', message: error.message } }, { status: 500 })
  }

  const activeSiloCount = silos?.length ?? 0
  const response = (silos ?? []).map((silo) => buildSiloResponse(silo, activeSiloCount, 5))

  return NextResponse.json(response)
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })
  }

  // CLAUDE.md Rule 8: check 5-silo limit before INSERT
  const limitReached = await checkSiloLimit(supabase, user.id)
  if (limitReached) {
    return NextResponse.json(
      { error: { code: 'SILO_LIMIT_REACHED', message: 'Maximum of 5 active silos reached' } },
      { status: 422 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Invalid request body' } }, { status: 400 })
  }

  const { name, platform_type, base_currency, drift_threshold } = body as {
    name?: unknown
    platform_type?: unknown
    base_currency?: unknown
    drift_threshold?: unknown
  }

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json({ error: { code: 'INVALID_VALUE', message: 'name is required' } }, { status: 400 })
  }

  if (!platform_type || !VALID_PLATFORM_TYPES.includes(platform_type as typeof VALID_PLATFORM_TYPES[number])) {
    return NextResponse.json(
      { error: { code: 'INVALID_VALUE', message: 'platform_type must be one of: alpaca | bitkub | innovestx | schwab | webull | manual' } },
      { status: 400 },
    )
  }

  const currency = typeof base_currency === 'string' && base_currency.length === 3
    ? base_currency.toUpperCase()
    : 'USD'

  const threshold = typeof drift_threshold === 'number' ? drift_threshold : 5.0

  const { data: newSilo, error: insertError } = await supabase
    .from('silos')
    .insert({
      user_id: user.id,
      name: name.trim(),
      platform_type,
      base_currency: currency,
      drift_threshold: threshold,
    })
    .select('*')
    .single()

  if (insertError || !newSilo) {
    return NextResponse.json({ error: { code: 'INSERT_FAILED', message: insertError?.message ?? 'Insert failed' } }, { status: 500 })
  }

  // Re-count after insert for the response
  const { count: newCount } = await supabase
    .from('silos')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_active', true)

  return NextResponse.json(buildSiloResponse(newSilo, newCount ?? 1, 5), { status: 201 })
}
