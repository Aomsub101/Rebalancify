/**
 * lib/bitkub.test.ts
 * TDD tests for BITKUB API helper functions.
 * All functions are pure — no network calls, no Supabase.
 */
import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import {
  buildBitkubSignature,
  parseBitkubTicker,
  parseBitkubWallet,
} from '@/lib/bitkub'

// ---------------------------------------------------------------------------
// buildBitkubSignature
// ---------------------------------------------------------------------------
describe('buildBitkubSignature', () => {
  it('returns a 64-character hex string (SHA-256 output)', () => {
    const result = buildBitkubSignature('{"ts":1711000000000}', 'my-secret')
    expect(result).toMatch(/^[0-9a-f]{64}$/)
  })

  it('produces the expected HMAC-SHA256 for known inputs', () => {
    const payload = '{"ts":1711000000000}'
    const secret = 'test-secret-key'
    const expected = createHmac('sha256', secret).update(payload).digest('hex')
    expect(buildBitkubSignature(payload, secret)).toBe(expected)
  })

  it('produces different signatures for different secrets', () => {
    const payload = '{"ts":1711000000000}'
    const sig1 = buildBitkubSignature(payload, 'secret-a')
    const sig2 = buildBitkubSignature(payload, 'secret-b')
    expect(sig1).not.toBe(sig2)
  })

  it('produces different signatures for different payloads', () => {
    const secret = 'my-secret'
    const sig1 = buildBitkubSignature('{"ts":1}', secret)
    const sig2 = buildBitkubSignature('{"ts":2}', secret)
    expect(sig1).not.toBe(sig2)
  })

  it('works with an empty JSON object payload', () => {
    const result = buildBitkubSignature('{}', 'key')
    expect(result).toHaveLength(64)
  })
})

// ---------------------------------------------------------------------------
// parseBitkubTicker
// ---------------------------------------------------------------------------
describe('parseBitkubTicker', () => {
  const sampleTicker = {
    THB_BTC: {
      id: 1, last: 1000000.0, lowestAsk: 1001000.0, highestBid: 999000.0,
      percentChange: 2.5, baseVolume: 100.0, quoteVolume: 100000000.0,
      isFrozen: 0, high24hr: 1100000.0, low24hr: 900000.0, change: 25000.0,
    },
    THB_ETH: {
      id: 2, last: 80000.0, lowestAsk: 80100.0, highestBid: 79900.0,
      percentChange: 1.2, baseVolume: 500.0, quoteVolume: 40000000.0,
      isFrozen: 0, high24hr: 85000.0, low24hr: 75000.0, change: 960.0,
    },
    THB_USDT: {
      id: 3, last: 33.5, lowestAsk: 33.6, highestBid: 33.4,
      percentChange: 0.1, baseVolume: 10000.0, quoteVolume: 335000.0,
      isFrozen: 0, high24hr: 34.0, low24hr: 33.0, change: 0.03,
    },
  }

  it('extracts one entry per THB pair', () => {
    const result = parseBitkubTicker(sampleTicker)
    expect(result).toHaveLength(3)
  })

  it('strips THB_ prefix to produce the symbol', () => {
    const result = parseBitkubTicker(sampleTicker)
    const symbols = result.map((r) => r.symbol)
    expect(symbols).toContain('BTC')
    expect(symbols).toContain('ETH')
    expect(symbols).toContain('USDT')
  })

  it('returns priceThb as a string with 8 decimal places', () => {
    const result = parseBitkubTicker(sampleTicker)
    const btc = result.find((r) => r.symbol === 'BTC')
    expect(btc).toBeDefined()
    expect(btc!.priceThb).toBe('1000000.00000000')
  })

  it('returns empty array for empty ticker response', () => {
    expect(parseBitkubTicker({})).toEqual([])
  })

  it('skips entries that do not start with THB_', () => {
    const mixed = {
      THB_BTC: sampleTicker.THB_BTC,
      BTC_ETH: {
        id: 99, last: 0.08, lowestAsk: 0.081, highestBid: 0.079,
        percentChange: 0, baseVolume: 0, quoteVolume: 0,
        isFrozen: 0, high24hr: 0, low24hr: 0, change: 0,
      },
    }
    const result = parseBitkubTicker(mixed)
    expect(result).toHaveLength(1)
    expect(result[0].symbol).toBe('BTC')
  })
})

// ---------------------------------------------------------------------------
// parseBitkubWallet — returns [holdings, thbBalance]
// ---------------------------------------------------------------------------
describe('parseBitkubWallet', () => {
  it('excludes THB from holdings array (THB is cash)', () => {
    const wallet = { error: 0, result: { THB: 5000.0, BTC: 0.5, ETH: 2.0 } }
    const [holdings] = parseBitkubWallet(wallet)
    const symbols = holdings.map((r) => r.symbol)
    expect(symbols).not.toContain('THB')
  })

  it('includes crypto assets with non-zero balances', () => {
    const wallet = { error: 0, result: { THB: 5000.0, BTC: 0.5, ETH: 2.0 } }
    const [holdings] = parseBitkubWallet(wallet)
    expect(holdings).toHaveLength(2)
    const btc = holdings.find((r) => r.symbol === 'BTC')
    expect(btc).toBeDefined()
    expect(btc!.quantity).toBe('0.50000000')
  })

  it('excludes zero-balance entries', () => {
    const wallet = { error: 0, result: { THB: 1000.0, BTC: 0.0, ETH: 0.5 } }
    const [holdings] = parseBitkubWallet(wallet)
    expect(holdings).toHaveLength(1)
    expect(holdings[0].symbol).toBe('ETH')
  })

  it('returns empty holdings array when result is empty', () => {
    const [holdings] = parseBitkubWallet({ error: 0, result: {} })
    expect(holdings).toEqual([])
  })

  it('returns empty holdings array when only THB is present', () => {
    const [holdings] = parseBitkubWallet({ error: 0, result: { THB: 9999.0 } })
    expect(holdings).toEqual([])
  })

  it('returns quantity as a string with 8 decimal places', () => {
    const wallet = { error: 0, result: { THB: 0, BTC: 0.12345678 } }
    const [holdings] = parseBitkubWallet(wallet)
    expect(holdings[0].quantity).toBe('0.12345678')
  })

  it('returns THB cash balance as the second tuple element', () => {
    const wallet = { error: 0, result: { THB: 12345.67, BTC: 1.0 } }
    const [, thbBalance] = parseBitkubWallet(wallet)
    expect(thbBalance).toBe('12345.67000000')
  })

  it('returns "0.00000000" as thbBalance when THB is absent', () => {
    const wallet = { error: 0, result: { BTC: 1.0 } }
    const [, thbBalance] = parseBitkubWallet(wallet)
    expect(thbBalance).toBe('0.00000000')
  })

  it('returns "0.00000000" as thbBalance when THB is zero', () => {
    const wallet = { error: 0, result: { THB: 0, BTC: 1.0 } }
    const [, thbBalance] = parseBitkubWallet(wallet)
    expect(thbBalance).toBe('0.00000000')
  })
})
