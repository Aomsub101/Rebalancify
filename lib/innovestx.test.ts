/**
 * lib/innovestx.test.ts
 * TDD tests for InnovestX / Settrade Open API helper functions.
 * All functions are pure — no network calls, no Supabase.
 */
import { describe, it, expect } from 'vitest'
import {
  buildSettradeBasicAuth,
  parseSettradePortfolio,
} from '@/lib/innovestx'

// ---------------------------------------------------------------------------
// buildSettradeBasicAuth
// ---------------------------------------------------------------------------
describe('buildSettradeBasicAuth', () => {
  it('returns a non-empty string', () => {
    const result = buildSettradeBasicAuth('myapp', 'mysecret')
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })

  it('produces the correct Base64 encoding of appId:appSecret', () => {
    const expected = Buffer.from('myapp:mysecret').toString('base64')
    expect(buildSettradeBasicAuth('myapp', 'mysecret')).toBe(expected)
  })

  it('handles App ID and App Secret with special characters', () => {
    const appId = 'app+id/test'
    const appSecret = 'secret=value&other'
    const expected = Buffer.from(`${appId}:${appSecret}`).toString('base64')
    expect(buildSettradeBasicAuth(appId, appSecret)).toBe(expected)
  })

  it('produces different output for different credentials', () => {
    const a = buildSettradeBasicAuth('id-a', 'secret-a')
    const b = buildSettradeBasicAuth('id-b', 'secret-b')
    expect(a).not.toBe(b)
  })

  it('round-trips: decoded value equals appId:appSecret', () => {
    const appId = 'test-app-id-123'
    const appSecret = 'test-secret-xyz'
    const encoded = buildSettradeBasicAuth(appId, appSecret)
    const decoded = Buffer.from(encoded, 'base64').toString('utf8')
    expect(decoded).toBe(`${appId}:${appSecret}`)
  })
})

// ---------------------------------------------------------------------------
// parseSettradePortfolio
// ---------------------------------------------------------------------------
describe('parseSettradePortfolio', () => {
  const sampleRaw = {
    portfolioList: [
      { symbol: 'PTT', volume: 100, marketValue: 42000.0, avgCost: 38.5 },
      { symbol: 'KBANK', volume: 50, marketValue: 6750.0, avgCost: 125.0 },
      { symbol: 'ADVANC', volume: 200, marketValue: 48000.0, avgCost: 220.0 },
    ],
  }

  it('returns one position per non-zero entry', () => {
    const result = parseSettradePortfolio(sampleRaw)
    expect(result).toHaveLength(3)
  })

  it('extracts the correct ticker symbol', () => {
    const result = parseSettradePortfolio(sampleRaw)
    const symbols = result.map((r) => r.ticker)
    expect(symbols).toContain('PTT')
    expect(symbols).toContain('KBANK')
    expect(symbols).toContain('ADVANC')
  })

  it('returns quantity as a string with 8 decimal places', () => {
    const result = parseSettradePortfolio(sampleRaw)
    const ptt = result.find((r) => r.ticker === 'PTT')
    expect(ptt).toBeDefined()
    expect(ptt!.quantity).toBe('100.00000000')
  })

  it('returns fractional quantities with 8 decimal places', () => {
    const raw = {
      portfolioList: [{ symbol: 'XYZ', volume: 12.345678, marketValue: 123.45 }],
    }
    const result = parseSettradePortfolio(raw)
    expect(result[0].quantity).toBe('12.34567800')
  })

  it('filters out zero-volume positions', () => {
    const raw = {
      portfolioList: [
        { symbol: 'PTT', volume: 0, marketValue: 0 },
        { symbol: 'KBANK', volume: 50, marketValue: 6750.0 },
      ],
    }
    const result = parseSettradePortfolio(raw)
    expect(result).toHaveLength(1)
    expect(result[0].ticker).toBe('KBANK')
  })

  it('filters out negative-volume positions', () => {
    const raw = {
      portfolioList: [
        { symbol: 'PTT', volume: -5, marketValue: 0 },
        { symbol: 'KBANK', volume: 10, marketValue: 1350.0 },
      ],
    }
    const result = parseSettradePortfolio(raw)
    expect(result).toHaveLength(1)
    expect(result[0].ticker).toBe('KBANK')
  })

  it('returns empty array when portfolioList is empty', () => {
    expect(parseSettradePortfolio({ portfolioList: [] })).toEqual([])
  })

  it('returns empty array when portfolioList is missing', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseSettradePortfolio({} as any)).toEqual([])
  })

  it('returns empty array when all positions have zero volume', () => {
    const raw = {
      portfolioList: [
        { symbol: 'A', volume: 0, marketValue: 0 },
        { symbol: 'B', volume: 0, marketValue: 0 },
      ],
    }
    expect(parseSettradePortfolio(raw)).toEqual([])
  })
})
