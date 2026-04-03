import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSilo, listSilos } from '@/lib/siloApi'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })
  }

  const result = await listSilos(supabase, user.id)
  if (!result.ok) return result.response
  return NextResponse.json(result.data)
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Invalid request body' } }, { status: 400 })
  }

  const result = await createSilo(supabase, user.id, body)
  if (!result.ok) return result.response
  return NextResponse.json(result.data, { status: 201 })
}
