/**
 * lib/innovestx.ts
 * Pure helper functions for the InnovestX / Settrade Open API.
 *
 * SECURITY (CLAUDE.md Rule 4 & 5):
 * - Never called from client components.
 * - These helpers are imported only by server-side Route Handlers.
 * - Plaintext API keys are never logged or returned.
 *
 * Auth model:
 *   Settrade Open API uses OAuth 2.0 client_credentials flow.
 *   App ID + App Secret → Basic Auth → Bearer access_token.
 *   Docs: https://developer.settrade.com/
 */

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Builds the Base64-encoded Basic Auth credential string for Settrade OAuth.
 * Format: base64(appId:appSecret)
 *
 * @param appId     Settrade App ID (stored as innovestx_key_enc)
 * @param appSecret Settrade App Secret (stored as innovestx_secret_enc)
 * @returns         Base64-encoded string for use in Authorization header
 */
export function buildSettradeBasicAuth(appId: string, appSecret: string): string {
  return Buffer.from(`${appId}:${appSecret}`).toString('base64')
}

// ---------------------------------------------------------------------------
// Portfolio parsing
// ---------------------------------------------------------------------------

export interface SettradePosition {
  ticker: string    // e.g. 'PTT', 'KBANK'
  quantity: string  // NUMERIC(20,8) string — share count
}

interface SettradePortfolioItem {
  symbol: string
  volume: number
  [key: string]: unknown
}

interface SettradePortfolioRaw {
  portfolioList?: SettradePortfolioItem[]
}

/**
 * Parses the Settrade portfolio endpoint response into a flat array.
 * Only positions with volume > 0 are included.
 *
 * @param raw  Raw JSON object from Settrade portfolio endpoint
 * @returns    Array of { ticker, quantity }
 */
export function parseSettradePortfolio(raw: SettradePortfolioRaw): SettradePosition[] {
  const list = raw.portfolioList ?? []
  return list
    .filter((item) => item.volume > 0)
    .map((item) => ({
      ticker: item.symbol,
      quantity: item.volume.toFixed(8),
    }))
}

// ---------------------------------------------------------------------------
// API constants (used by the route handler — not exported as lib functions)
// ---------------------------------------------------------------------------

export const SETTRADE_BASE_URL = 'https://open-api.settrade.com'
export const SETTRADE_TOKEN_PATH = '/api/ords/SETTrade/oauth/token'
export const SETTRADE_ACCOUNTS_PATH = '/api/ords/SETTrade/Investor/Account'
export const SETTRADE_PORTFOLIO_PATH = (accountNo: string) =>
  `/api/ords/SETTrade/Investor/Account/${encodeURIComponent(accountNo)}/Portfolio`
