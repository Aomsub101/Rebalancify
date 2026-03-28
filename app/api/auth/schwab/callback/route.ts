/**
 * GET /api/auth/schwab/callback
 *
 * OAuth 2.0 callback — exchanges the authorization code for access + refresh tokens,
 * encrypts both, and stores them in user_profiles.
 *
 * AC2: Exchanges code for tokens; both encrypted and stored in user_profiles.
 * AC3: schwab_token_expires set to NOW() + 7 days (refresh token lifetime).
 * AC4: After storage, GET /api/profile will return schwab_connected: true.
 * AC8: All Schwab HTTP calls are server-side only (CLAUDE.md Rule 5).
 *
 * SECURITY (CLAUDE.md Rule 4 & 5):
 * - CSRF: validates state cookie before processing.
 * - Tokens are encrypted with AES-256-GCM before storage (ENCRYPTION_KEY).
 * - Plaintext tokens are never returned, logged, or sent to the browser.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/encryption'
import { buildSchwabBasicAuth, SCHWAB_TOKEN_URL, SCHWAB_REFRESH_TOKEN_TTL_DAYS } from '@/lib/schwab'

interface SchwabTokenResponse {
  token_type: string
  access_token: string
  refresh_token: string
  expires_in: number
  scope?: string
  id_token?: string
}

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const settingsUrl = `${appUrl}/settings`

  // ── 1. Require authentication ──────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.redirect(new URL('/sign-in', appUrl))
  }

  // ── 2. Validate CSRF state ─────────────────────────────────────────────────
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const stateParam = searchParams.get('state')
  const errorParam = searchParams.get('error')

  // Schwab may return error=access_denied if user cancelled
  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/settings?schwab_error=${encodeURIComponent(errorParam)}`, appUrl),
    )
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(new URL('/settings?schwab_error=missing_code', appUrl))
  }

  const stateCookie = req.cookies.get('schwab_oauth_state')?.value
  if (!stateCookie || stateCookie !== stateParam) {
    return NextResponse.redirect(new URL('/settings?schwab_error=state_mismatch', appUrl))
  }

  // ── 3. Check required env vars ─────────────────────────────────────────────
  const clientId = process.env.SCHWAB_CLIENT_ID
  const clientSecret = process.env.SCHWAB_CLIENT_SECRET
  const encKey = process.env.ENCRYPTION_KEY

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/settings?schwab_error=not_configured', appUrl))
  }
  if (!encKey) {
    return NextResponse.redirect(new URL('/settings?schwab_error=server_error', appUrl))
  }

  const redirectUri = `${appUrl}/api/auth/schwab/callback`

  // ── 4. Exchange authorization code for tokens (server-side only — AC8) ────
  let tokenData: SchwabTokenResponse
  try {
    const basicAuth = buildSchwabBasicAuth(clientId, clientSecret)
    const tokenRes = await fetch(SCHWAB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
      cache: 'no-store',
    })

    if (!tokenRes.ok) {
      return NextResponse.redirect(new URL('/settings?schwab_error=token_exchange_failed', appUrl))
    }

    tokenData = (await tokenRes.json()) as SchwabTokenResponse
  } catch {
    return NextResponse.redirect(new URL('/settings?schwab_error=network_error', appUrl))
  }

  if (!tokenData.access_token || !tokenData.refresh_token) {
    return NextResponse.redirect(new URL('/settings?schwab_error=invalid_token_response', appUrl))
  }

  // ── 5. Encrypt tokens — never store plaintext (CLAUDE.md Rule 4) ──────────
  let accessEnc: string
  let refreshEnc: string
  try {
    accessEnc = encrypt(tokenData.access_token, encKey)
    refreshEnc = encrypt(tokenData.refresh_token, encKey)
  } catch {
    return NextResponse.redirect(new URL('/settings?schwab_error=server_error', appUrl))
  }

  // AC3: schwab_token_expires = refresh token expiry (7 days from now)
  const tokenExpires = new Date()
  tokenExpires.setDate(tokenExpires.getDate() + SCHWAB_REFRESH_TOKEN_TTL_DAYS)

  // ── 6. Store encrypted tokens in user_profiles ────────────────────────────
  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({
      schwab_access_enc: accessEnc,
      schwab_refresh_enc: refreshEnc,
      schwab_token_expires: tokenExpires.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (updateError) {
    return NextResponse.redirect(new URL('/settings?schwab_error=storage_failed', appUrl))
  }

  // ── 7. Clear the CSRF state cookie and redirect to Settings ───────────────
  const response = NextResponse.redirect(new URL('/settings?schwab_connected=true', appUrl))
  response.cookies.set('schwab_oauth_state', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,   // expire immediately
    path: '/',
  })

  return response
}
