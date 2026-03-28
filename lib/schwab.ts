/**
 * lib/schwab.ts
 * Pure helper functions for the Charles Schwab Developer API.
 *
 * SECURITY (CLAUDE.md Rule 4 & 5):
 * - Never called from client components.
 * - These helpers are imported only by server-side Route Handlers.
 * - Plaintext tokens are never logged or returned.
 *
 * Auth model:
 *   Standard OAuth 2.0 Authorization Code flow.
 *   Client credentials encoded as Basic Auth for token exchange.
 *   Access token: ~30 minutes.
 *   Refresh token: 7 days — stored as schwab_token_expires.
 *   Docs: https://developer.schwab.com/
 *
 * ⚠️ PREREQUISITE: Requires an approved Schwab developer app (Client ID + Secret).
 *    Approval takes 1–4 weeks. Verify exact endpoint URLs and scopes against
 *    the Schwab Individual Trader API docs when credentials are obtained.
 */

// ---------------------------------------------------------------------------
// API constants
// ---------------------------------------------------------------------------

export const SCHWAB_AUTH_URL = 'https://api.schwabapi.com/v1/oauth/authorize'
export const SCHWAB_TOKEN_URL = 'https://api.schwabapi.com/v1/oauth/token'

/**
 * Schwab trader API — accounts with positions.
 * Used by STORY-015b sync branch: GET /trader/v1/accounts?fields=positions
 */
export const SCHWAB_ACCOUNTS_URL = 'https://api.schwabapi.com/trader/v1/accounts'

/** Refresh tokens expire in 7 days per Schwab documentation. */
export const SCHWAB_REFRESH_TOKEN_TTL_DAYS = 7

// ---------------------------------------------------------------------------
// OAuth helpers
// ---------------------------------------------------------------------------

/**
 * Builds the Schwab authorization URL for the OAuth 2.0 Authorization Code flow.
 * The user is redirected here to grant access.
 *
 * @param clientId    Schwab developer app Client ID (SCHWAB_CLIENT_ID env var)
 * @param redirectUri Registered callback URI, e.g. https://app.example.com/api/auth/schwab/callback
 * @param state       Random CSRF-prevention token (UUID v4 recommended)
 * @returns           Full authorization URL to redirect the user to
 */
export function buildSchwabAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const url = new URL(SCHWAB_AUTH_URL)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  return url.toString()
}

/**
 * Builds the Basic Auth header value for Schwab token endpoint calls.
 * Format: base64(clientId:clientSecret)
 *
 * @param clientId     Schwab developer app Client ID
 * @param clientSecret Schwab developer app Client Secret
 * @returns            Base64-encoded credential string (use as Authorization: Basic <value>)
 */
export function buildSchwabBasicAuth(clientId: string, clientSecret: string): string {
  return Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
}

// ---------------------------------------------------------------------------
// Positions parsing
// ---------------------------------------------------------------------------

export interface SchwabPosition {
  symbol: string       // e.g. 'AAPL', 'MSFT'
  quantity: string     // NUMERIC(20,8) string — share count
  assetType: string    // e.g. 'EQUITY', 'ETF', 'CASH_EQUIVALENT'
  costBasis: string | null  // NUMERIC(20,8) string or null
}

interface SchwabInstrument {
  symbol: string
  assetType: string
  [key: string]: unknown
}

interface SchwabPositionRaw {
  instrument: SchwabInstrument
  longQuantity: number
  shortQuantity: number
  costBasis?: number
  [key: string]: unknown
}

interface SchwabSecuritiesAccount {
  positions?: SchwabPositionRaw[]
  [key: string]: unknown
}

interface SchwabAccountRaw {
  securitiesAccount: SchwabSecuritiesAccount
  [key: string]: unknown
}

/**
 * Parses the Schwab trader/v1/accounts?fields=positions response.
 * Returns only positions with a positive longQuantity (no cash equivalents
 * or zero-quantity entries unless they have quantity > 0).
 *
 * @param raw  Raw JSON array from GET /trader/v1/accounts?fields=positions
 * @returns    Array of SchwabPosition
 */
export function parseSchwabPositions(raw: SchwabAccountRaw[]): SchwabPosition[] {
  if (!Array.isArray(raw) || raw.length === 0) return []

  const positions: SchwabPosition[] = []

  for (const account of raw) {
    const rawPositions = account?.securitiesAccount?.positions ?? []
    for (const pos of rawPositions) {
      if (!pos?.instrument?.symbol) continue
      if (pos.longQuantity <= 0) continue

      positions.push({
        symbol: pos.instrument.symbol,
        quantity: pos.longQuantity.toFixed(8),
        assetType: pos.instrument.assetType ?? 'EQUITY',
        costBasis: pos.costBasis != null ? pos.costBasis.toFixed(8) : null,
      })
    }
  }

  return positions
}
