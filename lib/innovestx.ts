/**
 * lib/innovestx.ts
 * Pure helper functions for the InnovestX / Settrade Open API.
 *
 * SECURITY (CLAUDE.md Rule 4 & 5):
 * - Never called from client components.
 * - These helpers are imported only by server-side Route Handlers.
 * - Plaintext API keys are never logged or returned.
 *
 * Auth model (Equities):
 *   Settrade Open API uses OAuth 2.0 client_credentials flow.
 *   App ID + App Secret → Basic Auth → Bearer access_token.
 *   Docs: https://developer.settrade.com/
 *
 * Auth model (Digital Assets):
 *   HMAC-SHA256 signature over (timestamp + METHOD + path + body).
 *   Headers: X-INVX-APIKEY, X-INVX-SIGNATURE, X-INVX-TIMESTAMP, X-INVX-REQUEST-UID
 *   Docs: https://api-docs.innovestxonline.com/
 */
import { createHmac } from 'crypto'

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

// ---------------------------------------------------------------------------
// Digital Asset auth (HMAC-SHA256)
// ---------------------------------------------------------------------------

/**
 * Builds the HMAC-SHA256 request signature for the InnovestX Digital Asset API.
 *
 * Message format:  timestamp + METHOD.toUpperCase() + path + body
 * Algorithm:       HMAC-SHA256 → lowercase hex
 *
 * @param secret    Plaintext Digital Asset API Secret
 * @param timestamp Unix timestamp in milliseconds (string)
 * @param method    HTTP method (case-insensitive — always uppercased internally)
 * @param path      Request path including leading slash (e.g. '/api/v1/account/balances')
 * @param body      JSON-stringified request body, or '' for GET requests
 * @returns         64-character lowercase hex signature
 */
export function buildInnovestxDigitalSignature(
  secret: string,
  timestamp: string,
  method: string,
  path: string,
  body: string,
): string {
  const message = timestamp + method.toUpperCase() + path + body
  return createHmac('sha256', secret).update(message).digest('hex')
}

// ---------------------------------------------------------------------------
// Digital Asset balance parsing
// ---------------------------------------------------------------------------

export interface InnovestxDigitalHolding {
  symbol: string    // e.g. 'BTC', 'ETH'
  quantity: string  // as provided by API — already 8dp string
}

interface InnovestxDigitalAsset {
  symbol: string
  available: string
  locked: string
  [key: string]: unknown
}

interface InnovestxDigitalBalancesRaw {
  data?: {
    assets?: InnovestxDigitalAsset[]
    [key: string]: unknown
  }
}

/**
 * Parses the InnovestX Digital Asset balances endpoint response.
 * Only assets with a non-zero available balance are included.
 *
 * @param raw  Raw JSON object from GET /api/v1/account/balances
 * @returns    Array of { symbol, quantity }
 */
export function parseInnovestxDigitalBalances(
  raw: InnovestxDigitalBalancesRaw,
): InnovestxDigitalHolding[] {
  const assets = raw?.data?.assets ?? []
  return assets
    .filter((a) => parseFloat(a.available) > 0)
    .map((a) => ({
      symbol: a.symbol,
      quantity: a.available,
    }))
}

// ---------------------------------------------------------------------------
// Digital Asset API constants
// ---------------------------------------------------------------------------

export const INNOVESTX_DIGITAL_BASE_URL = 'https://api-digital.innovestxonline.com'
export const INNOVESTX_DIGITAL_BALANCES_PATH = '/api/v1/account/balances'
