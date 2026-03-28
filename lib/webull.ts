/**
 * lib/webull.ts — Webull API helper functions
 *
 * Authentication: HMAC-SHA256 signature (timestamp + METHOD + path).
 * Endpoint patterns are based on best-effort knowledge of the Webull broker
 * developer API; verify exact paths and headers against official docs once
 * credentials are obtained.
 *
 * All functions are pure and importable server-side only (CLAUDE.md Rule 5).
 */
import { createHmac } from 'crypto'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const WEBULL_BASE_URL = 'https://api.webull.com/api'
export const WEBULL_POSITIONS_PATH = '/v1/account/positions'
export const WEBULL_HOST = 'api.webull.com'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WebullPosition {
  ticker: string
  quantity: string
  costBasis: string | null
  assetType: 'stock' | 'crypto'
}

interface WebullPositionRaw {
  ticker?: { symbol?: string; type?: string } | null
  position?: string
  costPrice?: string | null
}

// ---------------------------------------------------------------------------
// Signature builder
// ---------------------------------------------------------------------------

/**
 * Build the HMAC-SHA256 request signature for Webull API calls.
 *
 * Message format: timestamp + METHOD.toUpperCase() + path
 * Returns a lowercase hex digest (64 chars).
 */
export function buildWebullSignature(
  apiSecret: string,
  method: string,
  path: string,
  timestamp: string,
): string {
  const message = timestamp + method.toUpperCase() + path
  return createHmac('sha256', apiSecret).update(message).digest('hex')
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

/**
 * Parse the Webull positions API response into a flat array.
 * Filters out positions with zero or non-positive quantity.
 * Gracefully ignores malformed entries.
 */
export function parseWebullPositions(raw: unknown): WebullPosition[] {
  if (!raw || typeof raw !== 'object') return []
  const obj = raw as Record<string, unknown>
  if (!Array.isArray(obj.data)) return []

  const positions: WebullPosition[] = []
  for (const item of obj.data) {
    if (!item || typeof item !== 'object') continue
    const p = item as WebullPositionRaw

    const symbol = p.ticker?.symbol
    const qty = p.position
    if (!symbol || !qty) continue

    const quantity = parseFloat(qty)
    if (isNaN(quantity) || quantity <= 0) continue

    const assetType: 'stock' | 'crypto' = p.ticker?.type === 'CRYPTO' ? 'crypto' : 'stock'

    positions.push({
      ticker: symbol,
      quantity: qty,
      costBasis: p.costPrice ?? null,
      assetType,
    })
  }
  return positions
}
