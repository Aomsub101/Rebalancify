/**
 * Integration tests for POST /api/silos/:silo_id/sync
 *
 * Required cases per docs/development/03-testing-strategy.md:
 *   1. Unauthenticated → 401
 *   2. Manual silo → 422 MANUAL_SILO_NO_SYNC
 *   3. Alpaca not connected (no key) → 403 ALPACA_NOT_CONNECTED
 *   4. Alpaca unreachable → 503 BROKER_UNAVAILABLE
 *   5. Happy path → 200 with holdings_updated count
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return {
    ...actual,
    NextResponse: {
      json: (body: unknown, init?: ResponseInit) => ({
        json: async () => body,
        status: init?.status ?? 200,
      }),
    },
  }
})

// Mock ENCRYPTION_KEY env var
vi.stubEnv('ENCRYPTION_KEY', 'a'.repeat(64))

// Pre-encrypt test keys using the same key so decrypt works in happy paths
import { encrypt } from '@/lib/encryption'
const TEST_ENC_KEY = 'a'.repeat(64)
const MOCK_ALPACA_KEY_ENC = encrypt('PKTEST123', TEST_ENC_KEY)
const MOCK_ALPACA_SECRET_ENC = encrypt('SKTEST456', TEST_ENC_KEY)
const MOCK_INVX_KEY_ENC = encrypt('SETTRADE_APP_ID', TEST_ENC_KEY)
const MOCK_INVX_SECRET_ENC = encrypt('SETTRADE_APP_SECRET', TEST_ENC_KEY)

const mockGetUser = vi.fn()

// Per-test Supabase mock — replaced in each describe block
let mockFromImpl: (table: string) => unknown = () => ({})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => mockFromImpl(table)),
  })),
}))

// Mock global fetch for Alpaca HTTP calls
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { POST } from '../sync/route'

function makeRequest(siloId = 'silo-uuid-1'): [import('next/server').NextRequest, { params: Promise<{ silo_id: string }> }] {
  const req = new Request(`http://localhost/api/silos/${siloId}/sync`, { method: 'POST' }) as import('next/server').NextRequest
  return [req, { params: Promise.resolve({ silo_id: siloId }) }]
}

// ── Helpers for chaining Supabase mock returns ────────────────────────────────

function singleChain(data: unknown, err: unknown = null) {
  const resolved = Promise.resolve({ data, error: err })
  return { single: vi.fn().mockReturnValue(resolved) }
}

function maybeSingleChain(data: unknown, err: unknown = null) {
  const resolved = Promise.resolve({ data, error: err })
  return { maybeSingle: vi.fn().mockReturnValue(resolved) }
}

function eqChain(result: unknown) {
  const chain: Record<string, unknown> = {}
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockReturnValue(Promise.resolve(result))
  chain.maybeSingle = vi.fn().mockReturnValue(Promise.resolve(result))
  return chain
}

function updateChain() {
  const resolved = Promise.resolve({ error: null })
  const chain: Record<string, unknown> = {}
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.then = vi.fn()
  // make it awaitable
  Object.assign(chain, resolved)
  return chain
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/silos/:silo_id/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('no auth') })
    const [req, ctx] = makeRequest()
    const res = await POST(req, ctx)
    expect(res.status).toBe(401)
  })

  it('returns 422 MANUAL_SILO_NO_SYNC for a manual silo', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockFromImpl = (table) => {
      if (table === 'silos') {
        const chain = eqChain({ data: { id: 'silo-1', platform_type: 'manual' }, error: null })
        return { select: vi.fn().mockReturnValue(chain) }
      }
      return {}
    }
    const [req, ctx] = makeRequest()
    const res = await POST(req, ctx)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('MANUAL_SILO_NO_SYNC')
  })

  it('returns 403 ALPACA_NOT_CONNECTED when no Alpaca key is stored', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    let callCount = 0
    mockFromImpl = (table) => {
      if (table === 'silos') {
        const chain = eqChain({ data: { id: 'silo-1', platform_type: 'alpaca' }, error: null })
        return { select: vi.fn().mockReturnValue(chain) }
      }
      if (table === 'user_profiles') {
        callCount++
        const chain = eqChain({ data: { alpaca_key_enc: null, alpaca_secret_enc: null, alpaca_mode: 'paper' }, error: null })
        return { select: vi.fn().mockReturnValue(chain) }
      }
      return {}
    }
    void callCount
    const [req, ctx] = makeRequest()
    const res = await POST(req, ctx)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ALPACA_NOT_CONNECTED')
  })

  it('returns 503 BROKER_UNAVAILABLE when Alpaca fetch fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockFromImpl = (table) => {
      if (table === 'silos') {
        const chain = eqChain({ data: { id: 'silo-1', platform_type: 'alpaca' }, error: null })
        return { select: vi.fn().mockReturnValue(chain) }
      }
      if (table === 'user_profiles') {
        const chain = eqChain({
          data: {
            alpaca_key_enc: MOCK_ALPACA_KEY_ENC,
            alpaca_secret_enc: MOCK_ALPACA_SECRET_ENC,
            alpaca_mode: 'paper',
          },
          error: null,
        })
        return { select: vi.fn().mockReturnValue(chain) }
      }
      return {}
    }
    mockFetch.mockRejectedValue(new Error('Network error'))
    const [req, ctx] = makeRequest()
    const res = await POST(req, ctx)
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('BROKER_UNAVAILABLE')
  })

  it('returns 200 with holdings_updated count on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    mockFromImpl = (table) => {
      if (table === 'silos') {
        const selectChain = eqChain({ data: { id: 'silo-1', platform_type: 'alpaca' }, error: null })
        const updateChain2: Record<string, unknown> = {}
        updateChain2.eq = vi.fn().mockReturnValue(updateChain2)
        updateChain2.update = vi.fn().mockReturnValue(updateChain2)
        // make awaitable
        Object.assign(updateChain2, Promise.resolve({ error: null }))
        return {
          select: vi.fn().mockReturnValue(selectChain),
          update: vi.fn().mockReturnValue(updateChain2),
        }
      }
      if (table === 'user_profiles') {
        const chain = eqChain({
          data: {
            alpaca_key_enc: MOCK_ALPACA_KEY_ENC,
            alpaca_secret_enc: MOCK_ALPACA_SECRET_ENC,
            alpaca_mode: 'paper',
          },
          error: null,
        })
        return { select: vi.fn().mockReturnValue(chain) }
      }
      if (table === 'assets') {
        // maybeSingle for find, single for insert
        const findChain = eqChain({ data: null, error: null })
        const insertSingleChain = singleChain({ id: 'asset-uuid-1' })
        const insertChain2 = { select: vi.fn().mockReturnValue(insertSingleChain) }
        const maybeSingleResult = { data: null, error: null }
        const maybeSingleChain2: Record<string, unknown> = {}
        maybeSingleChain2.eq = vi.fn().mockReturnValue(maybeSingleChain2)
        maybeSingleChain2.maybeSingle = vi.fn().mockReturnValue(Promise.resolve(maybeSingleResult))
        return {
          select: vi.fn().mockReturnValue(findChain),
          insert: vi.fn().mockReturnValue(insertChain2),
          maybeSingle: vi.fn().mockReturnValue(Promise.resolve(maybeSingleResult)),
        }
      }
      if (table === 'asset_mappings') {
        return { upsert: vi.fn().mockReturnValue(Promise.resolve({ error: null })) }
      }
      if (table === 'holdings') {
        const upsertRes = Promise.resolve({ error: null })
        const updateRes: Record<string, unknown> = {}
        updateRes.eq = vi.fn().mockReturnValue(updateRes)
        Object.assign(updateRes, Promise.resolve({ error: null }))
        return {
          upsert: vi.fn().mockReturnValue(upsertRes),
          update: vi.fn().mockReturnValue(updateRes),
        }
      }
      return {}
    }

    // Mock Alpaca responses
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ symbol: 'AAPL', qty: '10', asset_class: 'us_equity', cost_basis: '1500.00' }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cash: '500.00' }),
      })

    const [req, ctx] = makeRequest()
    const res = await POST(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.platform).toBe('alpaca')
    expect(body.cash_balance).toBe('500.00')
    expect(typeof body.synced_at).toBe('string')
  })
})

// ── InnovestX equity sync tests ───────────────────────────────────────────────

describe('POST /api/silos/:silo_id/sync — InnovestX equity branch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  })

  function makeInnovestxSiloMock(profileData: Record<string, unknown>) {
    return (table: string) => {
      if (table === 'silos') {
        const selectChain = eqChain({ data: { id: 'silo-1', platform_type: 'innovestx' }, error: null })
        const upd: Record<string, unknown> = {}
        upd.eq = vi.fn().mockReturnValue(upd)
        Object.assign(upd, Promise.resolve({ error: null }))
        return { select: vi.fn().mockReturnValue(selectChain), update: vi.fn().mockReturnValue(upd) }
      }
      if (table === 'user_profiles') {
        return { select: vi.fn().mockReturnValue(eqChain({ data: profileData, error: null })) }
      }
      if (table === 'assets') {
        const mb: Record<string, unknown> = {}
        mb.eq = vi.fn().mockReturnValue(mb)
        mb.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
        const ins = { select: vi.fn().mockReturnValue(singleChain({ id: 'asset-uuid-1' })) }
        return { select: vi.fn().mockReturnValue(mb), insert: vi.fn().mockReturnValue(ins) }
      }
      if (table === 'asset_mappings') {
        return { upsert: vi.fn().mockResolvedValue({ error: null }) }
      }
      if (table === 'holdings') {
        const upd: Record<string, unknown> = {}
        upd.eq = vi.fn().mockReturnValue(upd)
        Object.assign(upd, Promise.resolve({ error: null }))
        return { upsert: vi.fn().mockResolvedValue({ error: null }), update: vi.fn().mockReturnValue(upd) }
      }
      if (table === 'price_cache_fresh') {
        // Return stale so fetchPrice tries Finnhub
        return { select: vi.fn().mockReturnValue(eqChain({ data: null, error: null })) }
      }
      if (table === 'price_cache') {
        return { upsert: vi.fn().mockResolvedValue({ error: null }) }
      }
      return {}
    }
  }

  it('returns partial result with sync_warnings when equity credentials are missing (AC9)', async () => {
    mockFromImpl = makeInnovestxSiloMock({
      innovestx_key_enc: null,
      innovestx_secret_enc: null,
    })
    const [req, ctx] = makeRequest()
    const res = await POST(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.platform).toBe('innovestx')
    expect(body.holdings_updated).toBe(0)
    expect(Array.isArray(body.sync_warnings)).toBe(true)
    expect(body.sync_warnings.length).toBeGreaterThan(0)
  })

  it('returns 503 BROKER_UNAVAILABLE when Settrade auth fails (AC5)', async () => {
    mockFromImpl = makeInnovestxSiloMock({
      innovestx_key_enc: MOCK_INVX_KEY_ENC,
      innovestx_secret_enc: MOCK_INVX_SECRET_ENC,
    })
    mockFetch.mockRejectedValue(new Error('Network error'))
    const [req, ctx] = makeRequest()
    const res = await POST(req, ctx)
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('BROKER_UNAVAILABLE')
  })

  it('returns 200 with holdings_updated count on success (AC5, AC6, AC8)', async () => {
    mockFromImpl = makeInnovestxSiloMock({
      innovestx_key_enc: MOCK_INVX_KEY_ENC,
      innovestx_secret_enc: MOCK_INVX_SECRET_ENC,
    })

    // Settrade: token → accounts → portfolio | Finnhub: price
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok-abc', token_type: 'Bearer' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ account_no: 'ACC001' }] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          portfolioList: [
            { symbol: 'PTT', volume: 100, marketValue: 42000 },
            { symbol: 'KBANK', volume: 50, marketValue: 6750 },
          ],
        }),
      })
      // Finnhub price calls (one per holding)
      .mockResolvedValue({ ok: true, json: async () => ({ c: 420 }) })

    const [req, ctx] = makeRequest()
    const res = await POST(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.platform).toBe('innovestx')
    expect(body.holdings_updated).toBe(2)
    expect(typeof body.synced_at).toBe('string')
  })

  it('returns 200 with 0 holdings when portfolio is empty', async () => {
    mockFromImpl = makeInnovestxSiloMock({
      innovestx_key_enc: MOCK_INVX_KEY_ENC,
      innovestx_secret_enc: MOCK_INVX_SECRET_ENC,
    })
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok-abc', token_type: 'Bearer' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ account_no: 'ACC001' }] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ portfolioList: [] }) })

    const [req, ctx] = makeRequest()
    const res = await POST(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.holdings_updated).toBe(0)
  })
})
