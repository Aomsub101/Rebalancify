/**
 * lib/webull.test.ts — TDD tests for Webull helper functions (Red → Green)
 *
 * Tests: buildWebullSignature, parseWebullPositions
 */
import { describe, it, expect } from 'vitest'
import { buildWebullSignature, parseWebullPositions } from './webull'

// ── buildWebullSignature ──────────────────────────────────────────────────────

describe('buildWebullSignature', () => {
  it('returns a 64-character hex string (SHA-256)', () => {
    const sig = buildWebullSignature('secret', 'GET', '/v1/account/positions', '1700000000000')
    expect(sig).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic for identical inputs', () => {
    const sig1 = buildWebullSignature('secret', 'GET', '/v1/account/positions', '1700000000000')
    const sig2 = buildWebullSignature('secret', 'GET', '/v1/account/positions', '1700000000000')
    expect(sig1).toBe(sig2)
  })

  it('normalises method to uppercase (get === GET)', () => {
    const sigLower = buildWebullSignature('secret', 'get', '/v1/account/positions', '1700000000000')
    const sigUpper = buildWebullSignature('secret', 'GET', '/v1/account/positions', '1700000000000')
    expect(sigLower).toBe(sigUpper)
  })

  it('produces different signatures for different timestamps', () => {
    const sig1 = buildWebullSignature('secret', 'GET', '/v1/account/positions', '1700000000000')
    const sig2 = buildWebullSignature('secret', 'GET', '/v1/account/positions', '1700000000001')
    expect(sig1).not.toBe(sig2)
  })

  it('produces different signatures for different secrets', () => {
    const sig1 = buildWebullSignature('secret-a', 'GET', '/v1/account/positions', '1700000000000')
    const sig2 = buildWebullSignature('secret-b', 'GET', '/v1/account/positions', '1700000000000')
    expect(sig1).not.toBe(sig2)
  })

  it('produces different signatures for different paths', () => {
    const sig1 = buildWebullSignature('secret', 'GET', '/v1/account/positions', '1700000000000')
    const sig2 = buildWebullSignature('secret', 'GET', '/v1/account/orders', '1700000000000')
    expect(sig1).not.toBe(sig2)
  })
})

// ── parseWebullPositions ──────────────────────────────────────────────────────

describe('parseWebullPositions', () => {
  it('returns empty array for null input', () => {
    expect(parseWebullPositions(null)).toEqual([])
  })

  it('returns empty array for non-object input', () => {
    expect(parseWebullPositions('string')).toEqual([])
    expect(parseWebullPositions(42)).toEqual([])
  })

  it('returns empty array when data field is absent', () => {
    expect(parseWebullPositions({})).toEqual([])
  })

  it('returns empty array for an empty data array', () => {
    expect(parseWebullPositions({ data: [] })).toEqual([])
  })

  it('parses a single US stock position', () => {
    const raw = {
      data: [
        {
          ticker: { symbol: 'AAPL', type: 'US_STOCK' },
          position: '10.000000',
          costPrice: '150.000000',
        },
      ],
    }
    const result = parseWebullPositions(raw)
    expect(result).toHaveLength(1)
    expect(result[0].ticker).toBe('AAPL')
    expect(result[0].quantity).toBe('10.000000')
    expect(result[0].costBasis).toBe('150.000000')
    expect(result[0].assetType).toBe('stock')
  })

  it('sets assetType to crypto when ticker.type is CRYPTO', () => {
    const raw = {
      data: [
        {
          ticker: { symbol: 'BTC', type: 'CRYPTO' },
          position: '0.500000',
          costPrice: null,
        },
      ],
    }
    const result = parseWebullPositions(raw)
    expect(result).toHaveLength(1)
    expect(result[0].assetType).toBe('crypto')
    expect(result[0].costBasis).toBeNull()
  })

  it('filters out zero-quantity positions', () => {
    const raw = {
      data: [
        { ticker: { symbol: 'AAPL', type: 'US_STOCK' }, position: '0', costPrice: null },
        { ticker: { symbol: 'MSFT', type: 'US_STOCK' }, position: '5.000000', costPrice: '200.000000' },
        { ticker: { symbol: 'TSLA', type: 'US_STOCK' }, position: '0.000000', costPrice: null },
      ],
    }
    const result = parseWebullPositions(raw)
    expect(result).toHaveLength(1)
    expect(result[0].ticker).toBe('MSFT')
  })

  it('handles missing ticker or position fields without crashing', () => {
    const raw = {
      data: [
        { ticker: null, position: '10.000000' },
        { position: '5.000000' },                             // no ticker
        { ticker: { symbol: 'AAPL', type: 'US_STOCK' } },    // no position
        { ticker: { type: 'US_STOCK' }, position: '3.000000' }, // no symbol
      ],
    }
    expect(parseWebullPositions(raw)).toEqual([])
  })

  it('parses multiple positions and returns all non-zero ones', () => {
    const raw = {
      data: [
        { ticker: { symbol: 'AAPL', type: 'US_STOCK' }, position: '10.000000', costPrice: '150.000000' },
        { ticker: { symbol: 'MSFT', type: 'US_STOCK' }, position: '5.000000', costPrice: '200.000000' },
        { ticker: { symbol: 'NVDA', type: 'US_STOCK' }, position: '2.000000', costPrice: '450.000000' },
      ],
    }
    const result = parseWebullPositions(raw)
    expect(result).toHaveLength(3)
    expect(result.map(p => p.ticker)).toEqual(['AAPL', 'MSFT', 'NVDA'])
  })

  it('defaults costBasis to null when costPrice is missing', () => {
    const raw = {
      data: [
        { ticker: { symbol: 'AAPL', type: 'US_STOCK' }, position: '10.000000' },
      ],
    }
    const result = parseWebullPositions(raw)
    expect(result[0].costBasis).toBeNull()
  })

  it('defaults assetType to stock for unknown ticker type', () => {
    const raw = {
      data: [
        { ticker: { symbol: 'XYZ', type: 'UNKNOWN_TYPE' }, position: '1.000000', costPrice: null },
      ],
    }
    const result = parseWebullPositions(raw)
    expect(result[0].assetType).toBe('stock')
  })
})
