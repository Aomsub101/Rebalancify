import { NextResponse } from 'next/server'
import { encrypt } from '@/lib/encryption'
import { buildProfileResponse, type ProfileResponse, type ProfileRow } from '@/lib/profile'
import type { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>
type RouteResult<T> = { ok: true; data: T } | { ok: false; response: Response }

function invalidValue(message: string) {
  return NextResponse.json(
    { error: { code: 'INVALID_VALUE', message } },
    { status: 400 },
  )
}

export async function fetchProfileResponse(
  supabase: SupabaseClient,
  userId: string,
): Promise<RouteResult<ProfileResponse>> {
  const [profileResult, siloCountResult, notifCountResult] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('id', userId).single(),
    supabase.from('silos').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_active', true),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false),
  ])

  if (profileResult.error || !profileResult.data) {
    return {
      ok: false,
      response: NextResponse.json({ error: { code: 'PROFILE_NOT_FOUND', message: 'Profile not found' } }, { status: 404 }),
    }
  }

  return {
    ok: true,
    data: buildProfileResponse(
      profileResult.data as ProfileRow,
      siloCountResult.count ?? 0,
      notifCountResult.count ?? 0,
    ),
  }
}

export function buildProfileUpdatePayload(
  body: Record<string, unknown>,
  encryptionKey: string | undefined,
): RouteResult<Record<string, unknown>> {
  const allowed: Record<string, unknown> = {}

  if ('display_name' in body) {
    if (body.display_name !== null && typeof body.display_name !== 'string') {
      return { ok: false, response: invalidValue('display_name must be string or null') }
    }
    allowed.display_name = body.display_name
  }

  if ('show_usd_toggle' in body) {
    if (typeof body.show_usd_toggle !== 'boolean') {
      return { ok: false, response: invalidValue('show_usd_toggle must be boolean') }
    }
    allowed.show_usd_toggle = body.show_usd_toggle
  }

  if ('drift_notif_channel' in body) {
    const channel = body.drift_notif_channel
    if (channel !== 'app' && channel !== 'email' && channel !== 'both') {
      return { ok: false, response: invalidValue('drift_notif_channel must be app | email | both') }
    }
    allowed.drift_notif_channel = channel
  }

  if ('onboarded' in body) {
    if (typeof body.onboarded !== 'boolean') {
      return { ok: false, response: invalidValue('onboarded must be boolean') }
    }
    allowed.onboarded = body.onboarded
  }

  if ('progress_banner_dismissed' in body) {
    if (typeof body.progress_banner_dismissed !== 'boolean') {
      return { ok: false, response: invalidValue('progress_banner_dismissed must be boolean') }
    }
    allowed.progress_banner_dismissed = body.progress_banner_dismissed
  }

  if ('alpaca_key' in body || 'alpaca_secret' in body) {
    if (!encryptionKey) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: { code: 'ENCRYPTION_KEY_MISSING', message: 'Server encryption key not configured' } },
          { status: 500 },
        ),
      }
    }
    if ('alpaca_key' in body && typeof body.alpaca_key === 'string' && body.alpaca_key.length > 0) {
      allowed.alpaca_key_enc = encrypt(body.alpaca_key, encryptionKey)
    }
    if ('alpaca_secret' in body && typeof body.alpaca_secret === 'string' && body.alpaca_secret.length > 0) {
      allowed.alpaca_secret_enc = encrypt(body.alpaca_secret, encryptionKey)
    }
  }

  if ('alpaca_mode' in body) {
    const mode = body.alpaca_mode
    if (mode !== 'paper' && mode !== 'live') {
      return { ok: false, response: invalidValue('alpaca_mode must be paper | live') }
    }
    allowed.alpaca_mode = mode
  }

  if ('bitkub_key' in body || 'bitkub_secret' in body) {
    if (!encryptionKey) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: { code: 'ENCRYPTION_KEY_MISSING', message: 'Server encryption key not configured' } },
          { status: 500 },
        ),
      }
    }
    if ('bitkub_key' in body && typeof body.bitkub_key === 'string' && body.bitkub_key.length > 0) {
      allowed.bitkub_key_enc = encrypt(body.bitkub_key, encryptionKey)
    }
    if ('bitkub_secret' in body && typeof body.bitkub_secret === 'string' && body.bitkub_secret.length > 0) {
      allowed.bitkub_secret_enc = encrypt(body.bitkub_secret, encryptionKey)
    }
  }

  if ('innovestx_key' in body || 'innovestx_secret' in body) {
    if (!encryptionKey) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: { code: 'ENCRYPTION_KEY_MISSING', message: 'Server encryption key not configured' } },
          { status: 500 },
        ),
      }
    }
    if ('innovestx_key' in body && typeof body.innovestx_key === 'string' && body.innovestx_key.length > 0) {
      allowed.innovestx_key_enc = encrypt(body.innovestx_key, encryptionKey)
    }
    if ('innovestx_secret' in body && typeof body.innovestx_secret === 'string' && body.innovestx_secret.length > 0) {
      allowed.innovestx_secret_enc = encrypt(body.innovestx_secret, encryptionKey)
    }
  }

  if ('innovestx_digital_key' in body || 'innovestx_digital_secret' in body) {
    if (!encryptionKey) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: { code: 'ENCRYPTION_KEY_MISSING', message: 'Server encryption key not configured' } },
          { status: 500 },
        ),
      }
    }
    if ('innovestx_digital_key' in body && typeof body.innovestx_digital_key === 'string') {
      if (body.innovestx_digital_key.length > 0) allowed.innovestx_digital_key_enc = encrypt(body.innovestx_digital_key, encryptionKey)
      else if (body.innovestx_digital_key === '') allowed.innovestx_digital_key_enc = null
    }
    if ('innovestx_digital_secret' in body && typeof body.innovestx_digital_secret === 'string') {
      if (body.innovestx_digital_secret.length > 0) allowed.innovestx_digital_secret_enc = encrypt(body.innovestx_digital_secret, encryptionKey)
      else if (body.innovestx_digital_secret === '') allowed.innovestx_digital_secret_enc = null
    }
  }

  if ('webull_key' in body || 'webull_secret' in body) {
    if (!encryptionKey) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: { code: 'ENCRYPTION_KEY_MISSING', message: 'Server encryption key not configured' } },
          { status: 500 },
        ),
      }
    }
    if ('webull_key' in body && typeof body.webull_key === 'string' && body.webull_key.length > 0) {
      allowed.webull_key_enc = encrypt(body.webull_key, encryptionKey)
    }
    if ('webull_secret' in body && typeof body.webull_secret === 'string' && body.webull_secret.length > 0) {
      allowed.webull_secret_enc = encrypt(body.webull_secret, encryptionKey)
    }
  }

  if ('llm_provider' in body) {
    if (body.llm_provider !== null && typeof body.llm_provider !== 'string') {
      return { ok: false, response: invalidValue('llm_provider must be string or null') }
    }
    allowed.llm_provider = body.llm_provider
  }

  if ('llm_model' in body) {
    if (body.llm_model !== null && typeof body.llm_model !== 'string') {
      return { ok: false, response: invalidValue('llm_model must be string or null') }
    }
    allowed.llm_model = body.llm_model
  }

  if ('llm_key' in body && typeof body.llm_key === 'string' && body.llm_key.length > 0) {
    if (!encryptionKey) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: { code: 'ENCRYPTION_KEY_MISSING', message: 'Server encryption key not configured' } },
          { status: 500 },
        ),
      }
    }
    allowed.llm_key_enc = encrypt(body.llm_key, encryptionKey)
  }

  return { ok: true, data: allowed }
}
