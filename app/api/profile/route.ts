import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildProfileUpdatePayload, fetchProfileResponse } from '@/lib/profileApi'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })
  }

  const response = await fetchProfileResponse(supabase, user.id)
  if (!response.ok) return response.response
  return NextResponse.json(response.data)
}

export async function PATCH(request: Request) {
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

  const allowed = buildProfileUpdatePayload(body, process.env.ENCRYPTION_KEY)
  if (!allowed.ok) return allowed.response

  if (Object.keys(allowed.data).length === 0) {
    return NextResponse.json({ error: { code: 'NO_FIELDS', message: 'No updatable fields provided' } }, { status: 400 })
  }

  allowed.data.updated_at = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('user_profiles')
    .update(allowed.data)
    .eq('id', user.id)

  if (updateError) {
    return NextResponse.json({ error: { code: 'UPDATE_FAILED', message: updateError.message } }, { status: 500 })
  }

  const response = await fetchProfileResponse(supabase, user.id)
  if (!response.ok) return response.response
  return NextResponse.json(response.data)
}
