/**
 * lib/bitkub.ts
 * Pure helper functions for the BITKUB API.
 *
 * SECURITY (CLAUDE.md Rule 4 & 5):
 * - Never called from client components.
 * - These helpers are imported only by server-side Route Handlers.
 * - Plaintext API keys are never logged or returned.
 */
import { createHmac } from 'crypto'

// ---------------------------------------------------------------------------
// Signature
// ---------------------------------------------------------------------------

/**
 * Computes the HMAC-SHA256 signature for a BITKUB API request.
 * @param payloadJson  The JSON-stringified request body.
 * @param secret       The plaintext BITKUB API secret.
 * @returns            64-character lowercase hex string.
 */
export function buildBitkubSignature(payloadJson: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadJson).digest('hex')
}

// ---------------------------------------------------------------------------
// Ticker parsing
// ---------------------------------------------------------------------------

export interface BitkubTickerEntry {
  symbol: string    // e.g. 'BTC', 'ETH'
  priceThb: string  // NUMERIC(20,8) string — price in THB
}

type RawTickerMap = Record<string, { last: number; [key: string]: unknown }>

/**
 * Parses the BITKUB public ticker response into a flat array.
 * Only THB-quoted pairs (key starts with "THB_") are included.
 *
 * @param raw  The raw JSON object from GET /api/v2/market/ticker
 * @returns    Array of { symbol, priceThb }
 */
export function parseBitkubTicker(raw: RawTickerMap): BitkubTickerEntry[] {
  return Object.entries(raw)
    .filter(([key]) => key.startsWith('THB_'))
    .map(([key, val]) => ({
      symbol: key.slice(4), // strip "THB_"
      priceThb: val.last.toFixed(8),
    }))
}

// ---------------------------------------------------------------------------
// Wallet parsing
// ---------------------------------------------------------------------------

export interface BitkubHolding {
  symbol: string    // e.g. 'BTC'
  quantity: string  // NUMERIC(20,8) string
}

type RawWalletResult = { error: number; result: Record<string, number> }

/**
 * Parses the BITKUB wallet response.
 *
 * Returns a tuple:
 *   [0]  holdings — crypto assets with non-zero balances (THB excluded)
 *   [1]  thbBalance — THB cash balance as NUMERIC(20,8) string
 *
 * @param raw  The raw JSON object from POST /api/v2/market/wallet
 */
export function parseBitkubWallet(raw: RawWalletResult): [BitkubHolding[], string] {
  const result = raw.result ?? {}

  const thbRaw = result['THB'] ?? 0
  const thbBalance = thbRaw.toFixed(8)

  const holdings: BitkubHolding[] = Object.entries(result)
    .filter(([symbol, qty]) => symbol !== 'THB' && qty > 0)
    .map(([symbol, qty]) => ({
      symbol,
      quantity: qty.toFixed(8),
    }))

  return [holdings, thbBalance]
}
