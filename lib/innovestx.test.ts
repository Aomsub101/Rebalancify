/**
 * lib/innovestx.test.ts
 * TDD tests for InnovestX / Settrade Open API helper functions.
 * All functions are pure — no network calls, no Supabase.
 */
import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import {
  buildSettradeBasicAuth,
  parseSettradePortfolio,
  buildInnovestxDigitalSignature,
  parseInnovestxDigitalBalances,
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

// ---------------------------------------------------------------------------
// buildInnovestxDigitalSignature
// Correct format per api-docs.innovestxonline.com:
//   content_to_sign = apiKey + METHOD + host + path + query + contentType + requestUid + timestamp + body
// ---------------------------------------------------------------------------
describe('buildInnovestxDigitalSignature', () => {
  const apiKey = 'test-api-key-64chars-padded-to-64-chars-1234567890abcdef12345678'
  const secret = 'test-digital-secret'
  const timestamp = '1711584000000'
  const requestUid = '019d1bae-e2f1-42d9-b9e8-23d495dbe9f9'
  const method = 'GET'
  const host = 'api.innovestxonline.com'
  const path = '/api/v1/digital-asset/account/balance/inquiry'
  const query = ''
  const contentType = 'application/json'
  const body = ''

  it('returns a 64-character lowercase hex string', () => {
    const sig = buildInnovestxDigitalSignature(apiKey, secret, method, host, path, query, contentType, requestUid, timestamp, body)
    expect(sig).toHaveLength(64)
    expect(sig).toMatch(/^[0-9a-f]{64}$/)
  })

  it('produces the correct HMAC-SHA256 of (apiKey+METHOD+host+path+query+contentType+requestUid+timestamp+body)', () => {
    const message = apiKey + method.toUpperCase() + host + path + query + contentType + requestUid + timestamp + body
    const expected = createHmac('sha256', secret).update(message).digest('hex')
    expect(buildInnovestxDigitalSignature(apiKey, secret, method, host, path, query, contentType, requestUid, timestamp, body)).toBe(expected)
  })

  it('is case-insensitive on method — GET and get produce the same signature', () => {
    const upper = buildInnovestxDigitalSignature(apiKey, secret, 'GET', host, path, query, contentType, requestUid, timestamp, body)
    const lower = buildInnovestxDigitalSignature(apiKey, secret, 'get', host, path, query, contentType, requestUid, timestamp, body)
    expect(upper).toBe(lower)
  })

  it('produces a different signature for different secrets', () => {
    const sig1 = buildInnovestxDigitalSignature(apiKey, 'secret-a', method, host, path, query, contentType, requestUid, timestamp, body)
    const sig2 = buildInnovestxDigitalSignature(apiKey, 'secret-b', method, host, path, query, contentType, requestUid, timestamp, body)
    expect(sig1).not.toBe(sig2)
  })

  it('produces a different signature for different apiKeys', () => {
    const sig1 = buildInnovestxDigitalSignature('key-aaaa', secret, method, host, path, query, contentType, requestUid, timestamp, body)
    const sig2 = buildInnovestxDigitalSignature('key-bbbb', secret, method, host, path, query, contentType, requestUid, timestamp, body)
    expect(sig1).not.toBe(sig2)
  })

  it('produces a different signature for different timestamps', () => {
    const sig1 = buildInnovestxDigitalSignature(apiKey, secret, method, host, path, query, contentType, requestUid, '1000000', body)
    const sig2 = buildInnovestxDigitalSignature(apiKey, secret, method, host, path, query, contentType, requestUid, '9999999', body)
    expect(sig1).not.toBe(sig2)
  })

  it('includes body in the signature when body is non-empty', () => {
    const withBody = buildInnovestxDigitalSignature(apiKey, secret, 'POST', host, path, query, contentType, requestUid, timestamp, '{"symbol":"BTCTHB"}')
    const noBody   = buildInnovestxDigitalSignature(apiKey, secret, 'POST', host, path, query, contentType, requestUid, timestamp, '')
    expect(withBody).not.toBe(noBody)
  })

  it('includes query string in the signature when query is non-empty', () => {
    const withQuery = buildInnovestxDigitalSignature(apiKey, secret, method, host, path, '?limit=100', contentType, requestUid, timestamp, body)
    const noQuery   = buildInnovestxDigitalSignature(apiKey, secret, method, host, path, '', contentType, requestUid, timestamp, body)
    expect(withQuery).not.toBe(noQuery)
  })
})

// ---------------------------------------------------------------------------
// parseInnovestxDigitalBalances
// Correct shape per api-docs.innovestxonline.com GET /api/v1/digital-asset/account/balance/inquiry:
//   { code: "0000", message: "SUCCESS", data: [{ product, amount, hold, ... }] }
// data is a TOP-LEVEL array; field names are 'product' and 'amount' (not 'symbol'/'available')
// ---------------------------------------------------------------------------
describe('parseInnovestxDigitalBalances', () => {
  const sampleRaw = {
    code: '0000',
    message: 'SUCCESS',
    data: [
      { product: 'BTC', amount: '0.00500000', hold: '0.00000000', pendingDeposit: '0.00000000', pendingWithdraw: '0.00000000' },
      { product: 'ETH', amount: '1.23456789', hold: '0.00000000', pendingDeposit: '0.00000000', pendingWithdraw: '0.00000000' },
      { product: 'XRP', amount: '0.00000000', hold: '0.00000000', pendingDeposit: '0.00000000', pendingWithdraw: '0.00000000' },
    ],
  }

  it('returns one holding per non-zero asset', () => {
    const result = parseInnovestxDigitalBalances(sampleRaw)
    expect(result).toHaveLength(2)
  })

  it('extracts symbol from the product field', () => {
    const result = parseInnovestxDigitalBalances(sampleRaw)
    const symbols = result.map((r) => r.symbol)
    expect(symbols).toContain('BTC')
    expect(symbols).toContain('ETH')
    expect(symbols).not.toContain('XRP')
  })

  it('sets quantity from the amount field', () => {
    const result = parseInnovestxDigitalBalances(sampleRaw)
    const btc = result.find((r) => r.symbol === 'BTC')
    expect(btc?.quantity).toBe('0.00500000')
  })

  it('filters assets where amount is zero', () => {
    const raw = {
      code: '0000',
      data: [
        { product: 'BTC', amount: '0.00000000', hold: '0.00000000' },
        { product: 'ETH', amount: '2.00000000', hold: '0.00000000' },
      ],
    }
    const result = parseInnovestxDigitalBalances(raw)
    expect(result).toHaveLength(1)
    expect(result[0].symbol).toBe('ETH')
  })

  it('returns empty array when data array is empty', () => {
    expect(parseInnovestxDigitalBalances({ code: '0000', data: [] })).toEqual([])
  })

  it('returns empty array when data is missing', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseInnovestxDigitalBalances({} as any)).toEqual([])
  })

  it('returns empty array when raw is null/undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseInnovestxDigitalBalances(null as any)).toEqual([])
  })
})
