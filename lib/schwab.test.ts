/**
 * lib/schwab.test.ts
 * TDD tests for Charles Schwab OAuth helper functions.
 * All functions are pure — no network calls, no Supabase.
 */
import { describe, it, expect } from 'vitest'
import {
  buildSchwabAuthUrl,
  buildSchwabBasicAuth,
  parseSchwabPositions,
  SCHWAB_AUTH_URL,
  SCHWAB_TOKEN_URL,
} from '@/lib/schwab'

// ---------------------------------------------------------------------------
// buildSchwabAuthUrl
// ---------------------------------------------------------------------------
describe('buildSchwabAuthUrl', () => {
  const clientId = 'test-client-id'
  const redirectUri = 'https://app.example.com/api/auth/schwab/callback'
  const state = 'abc123-state-uuid'

  it('returns a URL starting with SCHWAB_AUTH_URL', () => {
    const url = buildSchwabAuthUrl(clientId, redirectUri, state)
    expect(url).toMatch(/^https:\/\/api\.schwabapi\.com\/v1\/oauth\/authorize/)
  })

  it('includes client_id in query params', () => {
    const url = buildSchwabAuthUrl(clientId, redirectUri, state)
    const parsed = new URL(url)
    expect(parsed.searchParams.get('client_id')).toBe(clientId)
  })

  it('includes redirect_uri in query params', () => {
    const url = buildSchwabAuthUrl(clientId, redirectUri, state)
    const parsed = new URL(url)
    expect(parsed.searchParams.get('redirect_uri')).toBe(redirectUri)
  })

  it('includes state in query params', () => {
    const url = buildSchwabAuthUrl(clientId, redirectUri, state)
    const parsed = new URL(url)
    expect(parsed.searchParams.get('state')).toBe(state)
  })

  it('sets response_type=code', () => {
    const url = buildSchwabAuthUrl(clientId, redirectUri, state)
    const parsed = new URL(url)
    expect(parsed.searchParams.get('response_type')).toBe('code')
  })

  it('produces a valid parseable URL', () => {
    const url = buildSchwabAuthUrl(clientId, redirectUri, state)
    expect(() => new URL(url)).not.toThrow()
  })

  it('different states produce different URLs', () => {
    const url1 = buildSchwabAuthUrl(clientId, redirectUri, 'state-a')
    const url2 = buildSchwabAuthUrl(clientId, redirectUri, 'state-b')
    expect(url1).not.toBe(url2)
  })

  it('encodes redirect_uri with special characters correctly', () => {
    const uri = 'https://example.com/callback?foo=bar'
    const url = buildSchwabAuthUrl(clientId, uri, state)
    const parsed = new URL(url)
    expect(parsed.searchParams.get('redirect_uri')).toBe(uri)
  })
})

// ---------------------------------------------------------------------------
// buildSchwabBasicAuth
// ---------------------------------------------------------------------------
describe('buildSchwabBasicAuth', () => {
  it('returns a non-empty string', () => {
    expect(buildSchwabBasicAuth('id', 'secret')).toBeTruthy()
  })

  it('produces the correct Base64 encoding of clientId:clientSecret', () => {
    const expected = Buffer.from('my-client-id:my-client-secret').toString('base64')
    expect(buildSchwabBasicAuth('my-client-id', 'my-client-secret')).toBe(expected)
  })

  it('round-trips: decoded value equals clientId:clientSecret', () => {
    const clientId = 'schwab-app-id-123'
    const clientSecret = 'schwab-secret-xyz'
    const encoded = buildSchwabBasicAuth(clientId, clientSecret)
    const decoded = Buffer.from(encoded, 'base64').toString('utf8')
    expect(decoded).toBe(`${clientId}:${clientSecret}`)
  })

  it('produces different output for different credentials', () => {
    const a = buildSchwabBasicAuth('id-a', 'secret-a')
    const b = buildSchwabBasicAuth('id-b', 'secret-b')
    expect(a).not.toBe(b)
  })

  it('handles credentials with special characters', () => {
    const id = 'client+id/test='
    const secret = 'secret=value&other'
    const expected = Buffer.from(`${id}:${secret}`).toString('base64')
    expect(buildSchwabBasicAuth(id, secret)).toBe(expected)
  })
})

// ---------------------------------------------------------------------------
// parseSchwabPositions
// Schwab trader/v1/accounts?fields=positions response shape:
//   [{ securitiesAccount: { positions: [{ instrument, longQuantity, costBasis }] } }]
// ---------------------------------------------------------------------------
describe('parseSchwabPositions', () => {
  const sampleRaw = [
    {
      securitiesAccount: {
        type: 'MARGIN',
        accountNumber: '12345678',
        positions: [
          {
            instrument: { symbol: 'AAPL', assetType: 'EQUITY' },
            longQuantity: 10,
            shortQuantity: 0,
            costBasis: 1500.00,
          },
          {
            instrument: { symbol: 'MSFT', assetType: 'EQUITY' },
            longQuantity: 5,
            shortQuantity: 0,
            costBasis: 2000.00,
          },
          {
            instrument: { symbol: 'SPAXX', assetType: 'CASH_EQUIVALENT' },
            longQuantity: 300.50,
            shortQuantity: 0,
            costBasis: 300.50,
          },
        ],
      },
    },
  ]

  it('returns one position per non-zero longQuantity entry', () => {
    const result = parseSchwabPositions(sampleRaw)
    expect(result.length).toBeGreaterThanOrEqual(2)
  })

  it('extracts symbol correctly', () => {
    const result = parseSchwabPositions(sampleRaw)
    const symbols = result.map((r) => r.symbol)
    expect(symbols).toContain('AAPL')
    expect(symbols).toContain('MSFT')
  })

  it('returns quantity as a string with 8 decimal places', () => {
    const result = parseSchwabPositions(sampleRaw)
    const aapl = result.find((r) => r.symbol === 'AAPL')
    expect(aapl).toBeDefined()
    expect(aapl!.quantity).toBe('10.00000000')
  })

  it('returns fractional quantities with 8 decimal places', () => {
    const result = parseSchwabPositions(sampleRaw)
    const spaxx = result.find((r) => r.symbol === 'SPAXX')
    expect(spaxx).toBeDefined()
    expect(spaxx!.quantity).toBe('300.50000000')
  })

  it('returns costBasis as a string with 8 decimal places when present', () => {
    const result = parseSchwabPositions(sampleRaw)
    const aapl = result.find((r) => r.symbol === 'AAPL')
    expect(aapl!.costBasis).toBe('1500.00000000')
  })

  it('filters positions with zero longQuantity', () => {
    const raw = [
      {
        securitiesAccount: {
          positions: [
            { instrument: { symbol: 'AAPL', assetType: 'EQUITY' }, longQuantity: 0, shortQuantity: 0, costBasis: 0 },
            { instrument: { symbol: 'MSFT', assetType: 'EQUITY' }, longQuantity: 5, shortQuantity: 0, costBasis: 100 },
          ],
        },
      },
    ]
    const result = parseSchwabPositions(raw)
    expect(result.find((r) => r.symbol === 'AAPL')).toBeUndefined()
    expect(result.find((r) => r.symbol === 'MSFT')).toBeDefined()
  })

  it('returns empty array when positions array is empty', () => {
    const raw = [{ securitiesAccount: { positions: [] } }]
    expect(parseSchwabPositions(raw)).toEqual([])
  })

  it('returns empty array when input array is empty', () => {
    expect(parseSchwabPositions([])).toEqual([])
  })

  it('returns empty array when input is null/undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseSchwabPositions(null as any)).toEqual([])
  })

  it('handles missing positions key gracefully', () => {
    const raw = [{ securitiesAccount: {} }]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseSchwabPositions(raw as any)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Constants sanity checks
// ---------------------------------------------------------------------------
describe('Schwab API constants', () => {
  it('SCHWAB_AUTH_URL points to the correct Schwab authorization endpoint', () => {
    expect(SCHWAB_AUTH_URL).toBe('https://api.schwabapi.com/v1/oauth/authorize')
  })

  it('SCHWAB_TOKEN_URL points to the correct Schwab token endpoint', () => {
    expect(SCHWAB_TOKEN_URL).toBe('https://api.schwabapi.com/v1/oauth/token')
  })
})
