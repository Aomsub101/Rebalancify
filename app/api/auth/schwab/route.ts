/**
 * GET /api/auth/schwab
 *
 * Initiates the Charles Schwab OAuth 2.0 Authorization Code flow.
 * AC1: "Connect Schwab" button in Settings navigates here;
 *       this route generates a CSRF state token and redirects to Schwab.
 *
 * SECURITY (CLAUDE.md Rule 4 & 5):
 * - Server-side only — no Schwab API keys exposed to the browser.
 * - State token stored in an HTTP-only cookie to prevent CSRF.
 * - SCHWAB_CLIENT_ID is read server-side from env vars.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildSchwabAuthUrl } from '@/lib/schwab'

export async function GET(_req: NextRequest) {
  // Require authentication — user must be logged in before connecting Schwab
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.redirect(new URL('/sign-in', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'))
  }

  const clientId = process.env.SCHWAB_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: { code: 'SCHWAB_NOT_CONFIGURED', message: 'Schwab OAuth is not configured on this server' } },
      { status: 503 },
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/auth/schwab/callback`

  // Generate a random CSRF state token (UUID v4)
  const state = crypto.randomUUID()

  // Build the Schwab authorization URL
  const authUrl = buildSchwabAuthUrl(clientId, redirectUri, state)

  // Store state in an HTTP-only cookie (60 min TTL — Schwab auth should complete well within this)
  const response = NextResponse.redirect(authUrl)
  response.cookies.set('schwab_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60, // 60 minutes
    path: '/',
  })

  return response
}
