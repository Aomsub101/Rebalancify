import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildProfileResponse } from '@/lib/profile'
import { encrypt } from '@/lib/encryption'

function invalidValue(message: string) {
  return NextResponse.json(
    { error: { code: 'INVALID_VALUE', message } },
    { status: 400 },
  )
}

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

  const allowed: Record<string, unknown> = {}
  if ('display_name' in body) {
    if (body.display_name !== null && typeof body.display_name !== 'string') {
      return invalidValue('display_name must be string or null')
    }
    allowed.display_name = body.display_name
  }
  if ('show_usd_toggle' in body) {
    if (typeof body.show_usd_toggle !== 'boolean') {
      return invalidValue('show_usd_toggle must be boolean')
    }
    allowed.show_usd_toggle = body.show_usd_toggle
  }
  if ('drift_notif_channel' in body) {
    const channel = body.drift_notif_channel
    if (channel !== 'app' && channel !== 'email' && channel !== 'both') {
      return invalidValue('drift_notif_channel must be app | email | both')
    }
    allowed.drift_notif_channel = channel
  }
  if ('onboarded' in body) {
    if (typeof body.onboarded !== 'boolean') {
      return invalidValue('onboarded must be boolean')
    }
    allowed.onboarded = body.onboarded
  }
  if ('progress_banner_dismissed' in body) {
    if (typeof body.progress_banner_dismissed !== 'boolean') {
      return invalidValue('progress_banner_dismissed must be boolean')
    }
    allowed.progress_banner_dismissed = body.progress_banner_dismissed
  }

  // Alpaca credentials — STORY-009 (CLAUDE.md Rule 4: encrypt before storage, never return plaintext)
  const encKey = process.env.ENCRYPTION_KEY
  if ('alpaca_key' in body || 'alpaca_secret' in body) {
    if (!encKey) {
      return NextResponse.json(
        { error: { code: 'ENCRYPTION_KEY_MISSING', message: 'Server encryption key not configured' } },
        { status: 500 },
      )
    }
    if ('alpaca_key' in body && typeof body.alpaca_key === 'string' && body.alpaca_key.length > 0) {
      allowed.alpaca_key_enc = encrypt(body.alpaca_key, encKey)
    }
    if ('alpaca_secret' in body && typeof body.alpaca_secret === 'string' && body.alpaca_secret.length > 0) {
      allowed.alpaca_secret_enc = encrypt(body.alpaca_secret, encKey)
    }
  }
  if ('alpaca_mode' in body) {
    const mode = body.alpaca_mode
    if (mode !== 'paper' && mode !== 'live') {
      return invalidValue('alpaca_mode must be paper | live')
    }
    allowed.alpaca_mode = mode
  }

  // BITKUB credentials — STORY-013 (CLAUDE.md Rule 4: encrypt before storage, never return plaintext)
  if ('bitkub_key' in body || 'bitkub_secret' in body) {
    if (!encKey) {
      return NextResponse.json(
        { error: { code: 'ENCRYPTION_KEY_MISSING', message: 'Server encryption key not configured' } },
        { status: 500 },
      )
    }
    if ('bitkub_key' in body && typeof body.bitkub_key === 'string' && body.bitkub_key.length > 0) {
      allowed.bitkub_key_enc = encrypt(body.bitkub_key, encKey)
    }
    if ('bitkub_secret' in body && typeof body.bitkub_secret === 'string' && body.bitkub_secret.length > 0) {
      allowed.bitkub_secret_enc = encrypt(body.bitkub_secret, encKey)
    }
  }

  // InnovestX equity credentials (Settrade App ID + App Secret) — STORY-014
  // AC1: encrypt and store in innovestx_key_enc / innovestx_secret_enc
  if ('innovestx_key' in body || 'innovestx_secret' in body) {
    if (!encKey) {
      return NextResponse.json(
        { error: { code: 'ENCRYPTION_KEY_MISSING', message: 'Server encryption key not configured' } },
        { status: 500 },
      )
    }
    if ('innovestx_key' in body && typeof body.innovestx_key === 'string' && body.innovestx_key.length > 0) {
      allowed.innovestx_key_enc = encrypt(body.innovestx_key, encKey)
    }
    if ('innovestx_secret' in body && typeof body.innovestx_secret === 'string' && body.innovestx_secret.length > 0) {
      allowed.innovestx_secret_enc = encrypt(body.innovestx_secret, encKey)
    }
  }

  // InnovestX Digital Asset credentials — STORY-014b
  // AC1: encrypt and store in innovestx_digital_key_enc / innovestx_digital_secret_enc
  if ('innovestx_digital_key' in body || 'innovestx_digital_secret' in body) {
    if (!encKey) {
      return NextResponse.json(
        { error: { code: 'ENCRYPTION_KEY_MISSING', message: 'Server encryption key not configured' } },
        { status: 500 },
      )
    }
    if ('innovestx_digital_key' in body && typeof body.innovestx_digital_key === 'string') {
      if (body.innovestx_digital_key.length > 0) allowed.innovestx_digital_key_enc = encrypt(body.innovestx_digital_key, encKey)
      else if (body.innovestx_digital_key === '') allowed.innovestx_digital_key_enc = null
    }
    if ('innovestx_digital_secret' in body && typeof body.innovestx_digital_secret === 'string') {
      if (body.innovestx_digital_secret.length > 0) allowed.innovestx_digital_secret_enc = encrypt(body.innovestx_digital_secret, encKey)
      else if (body.innovestx_digital_secret === '') allowed.innovestx_digital_secret_enc = null
    }
  }

  // Webull credentials — STORY-016 (CLAUDE.md Rule 4: encrypt before storage, never return plaintext)
  if ('webull_key' in body || 'webull_secret' in body) {
    if (!encKey) {
      return NextResponse.json(
        { error: { code: 'ENCRYPTION_KEY_MISSING', message: 'Server encryption key not configured' } },
        { status: 500 },
      )
    }
    if ('webull_key' in body && typeof body.webull_key === 'string' && body.webull_key.length > 0) {
      allowed.webull_key_enc = encrypt(body.webull_key, encKey)
    }
    if ('webull_secret' in body && typeof body.webull_secret === 'string' && body.webull_secret.length > 0) {
      allowed.webull_secret_enc = encrypt(body.webull_secret, encKey)
    }
  }

  // LLM credentials — STORY-030 (CLAUDE.md Rule 4: encrypt before storage, never return plaintext)
  if ('llm_provider' in body) {
    if (body.llm_provider !== null && typeof body.llm_provider !== 'string') {
      return invalidValue('llm_provider must be string or null')
    }
    allowed.llm_provider = body.llm_provider
  }
  if ('llm_model' in body) {
    if (body.llm_model !== null && typeof body.llm_model !== 'string') {
      return invalidValue('llm_model must be string or null')
    }
    allowed.llm_model = body.llm_model
  }
  if ('llm_key' in body && typeof body.llm_key === 'string' && body.llm_key.length > 0) {
    if (!encKey) {
      return NextResponse.json(
        { error: { code: 'ENCRYPTION_KEY_MISSING', message: 'Server encryption key not configured' } },
        { status: 500 },
      )
    }
    allowed.llm_key_enc = encrypt(body.llm_key, encKey)
  }

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
