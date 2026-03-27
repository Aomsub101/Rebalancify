import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildProfileResponse } from '@/lib/profile'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })
  }

  const [profileResult, siloCountResult, notifCountResult] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('id', user.id).single(),
    supabase.from('silos').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_active', true),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
  ])

  if (profileResult.error || !profileResult.data) {
    return NextResponse.json({ error: { code: 'PROFILE_NOT_FOUND', message: 'Profile not found' } }, { status: 404 })
  }

  const response = buildProfileResponse(
    profileResult.data,
    siloCountResult.count ?? 0,
    notifCountResult.count ?? 0,
  )

  return NextResponse.json(response)
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

  // Only allow safe, non-key fields to be updated via this endpoint in STORY-005 scope.
  // API key fields (alpaca_key, bitkub_key, etc.) are handled in EPIC-03/04 stories.
  const allowed: Record<string, unknown> = {}
  if ('display_name' in body) allowed.display_name = body.display_name
  if ('show_usd_toggle' in body) allowed.show_usd_toggle = body.show_usd_toggle
  if ('drift_notif_channel' in body) {
    const channel = body.drift_notif_channel
    if (channel !== 'app' && channel !== 'email' && channel !== 'both') {
      return NextResponse.json(
        { error: { code: 'INVALID_VALUE', message: 'drift_notif_channel must be app | email | both' } },
        { status: 400 },
      )
    }
    allowed.drift_notif_channel = channel
  }
  if ('onboarded' in body) allowed.onboarded = body.onboarded
  if ('progress_banner_dismissed' in body) allowed.progress_banner_dismissed = body.progress_banner_dismissed

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: { code: 'NO_FIELDS', message: 'No updatable fields provided' } }, { status: 400 })
  }

  allowed.updated_at = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('user_profiles')
    .update(allowed)
    .eq('id', user.id)

  if (updateError) {
    return NextResponse.json({ error: { code: 'UPDATE_FAILED', message: updateError.message } }, { status: 500 })
  }

  // Return the updated profile (same shape as GET)
  const [profileResult, siloCountResult, notifCountResult] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('id', user.id).single(),
    supabase.from('silos').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_active', true),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
  ])

  if (profileResult.error || !profileResult.data) {
    return NextResponse.json({ error: { code: 'PROFILE_NOT_FOUND', message: 'Profile not found' } }, { status: 404 })
  }

  const response = buildProfileResponse(
    profileResult.data,
    siloCountResult.count ?? 0,
    notifCountResult.count ?? 0,
  )

  return NextResponse.json(response)
}
