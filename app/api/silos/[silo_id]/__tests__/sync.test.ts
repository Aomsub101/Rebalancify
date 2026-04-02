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
const MOCK_SCHWAB_ACCESS_ENC = encrypt('schwab-access-token-xyz', TEST_ENC_KEY)
const MOCK_SCHWAB_REFRESH_ENC = encrypt('schwab-refresh-token-abc', TEST_ENC_KEY)
const MOCK_WEBULL_KEY_ENC = encrypt('WBL_API_KEY_TEST', TEST_ENC_KEY)
const MOCK_WEBULL_SECRET_ENC = encrypt('WBL_API_SECRET_TEST', TEST_ENC_KEY)

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

function deleteEqChain() {
  const chain: Record<string, unknown> = { data: null, error: null }
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.in = vi.fn().mockReturnValue(chain)
  chain.neq = vi.fn().mockReturnValue(chain)
  return chain
}

function selectEqChain(data: unknown) {
  const chain: Record<string, unknown> = { data, error: null }
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.maybeSingle = vi.fn().mockResolvedValue({ data, error: null })
  return chain
}

function plainUpdateChain() {
  const chain: Record<string, unknown> = { error: null }
  chain.eq = vi.fn().mockReturnValue(chain)
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
        return {
          select: vi.fn().mockReturnValue(selectEqChain([])),
          upsert: vi.fn().mockReturnValue(Promise.resolve({ error: null })),
          delete: vi.fn().mockReturnValue(deleteEqChain()),
        }
      }
      if (table === 'holdings') {
        const delChain: Record<string, unknown> = {}
        delChain.eq = vi.fn().mockReturnValue(delChain)
        delChain.neq = vi.fn().mockReturnValue(delChain)
        delChain.in = vi.fn().mockReturnValue(delChain)
        Object.assign(delChain, Promise.resolve({ error: null }))
        const upsertRes = Promise.resolve({ error: null })
        const updateRes: Record<string, unknown> = {}
        updateRes.eq = vi.fn().mockReturnValue(updateRes)
        Object.assign(updateRes, Promise.resolve({ error: null }))
        return {
          select: vi.fn().mockReturnValue(selectEqChain([])),
          upsert: vi.fn().mockReturnValue(upsertRes),
          delete: vi.fn().mockReturnValue(delChain),
          update: vi.fn().mockReturnValue(updateRes),
        }
      }
      if (table === 'target_weights') {
        return {
          select: vi.fn().mockReturnValue(selectEqChain([])),
          delete: vi.fn().mockReturnValue(deleteEqChain()),
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

  it('replaces stale Alpaca holdings when a sold position disappears from the latest sync', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    const holdingsDeleteChain = deleteEqChain()
    const holdingsDelete = vi.fn().mockReturnValue(holdingsDeleteChain)
    const holdingsUpsert = vi.fn().mockResolvedValue({ error: null })

    mockFromImpl = (table) => {
      if (table === 'silos') {
        const selectChain = eqChain({ data: { id: 'silo-1', platform_type: 'alpaca' }, error: null })
        const siloUpdate = plainUpdateChain()
        return {
          select: vi.fn().mockReturnValue(selectChain),
          update: vi.fn().mockReturnValue(siloUpdate),
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
        const assetQuery = selectEqChain({ id: 'asset-aapl' })
        return { select: vi.fn().mockReturnValue(assetQuery) }
      }
      if (table === 'asset_mappings') {
        return {
          select: vi.fn().mockReturnValue(selectEqChain([])),
          upsert: vi.fn().mockResolvedValue({ error: null }),
          delete: vi.fn().mockReturnValue(deleteEqChain()),
        }
      }
      if (table === 'holdings') {
        return {
          select: vi.fn().mockReturnValue(selectEqChain([])),
          delete: holdingsDelete,
          upsert: holdingsUpsert,
        }
      }
      if (table === 'target_weights') {
        return {
          select: vi.fn().mockReturnValue(selectEqChain([])),
          delete: vi.fn().mockReturnValue(deleteEqChain()),
        }
      }
      return {}
    }

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ symbol: 'AAPL', qty: '50', asset_class: 'us_equity', cost_basis: '7500.00' }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cash: '1250.00' }),
      })

    const [req, ctx] = makeRequest()
    const res = await POST(req, ctx)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.holdings_updated).toBe(1)
    expect(holdingsDelete).toHaveBeenCalledTimes(1)
    expect(holdingsDeleteChain.eq).toHaveBeenCalledWith('silo_id', 'silo-uuid-1')
    expect(holdingsUpsert).toHaveBeenCalledTimes(1)
  })

  it('clears Alpaca synced holdings when the broker returns no positions', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    const holdingsDeleteChain = deleteEqChain()
    const holdingsDelete = vi.fn().mockReturnValue(holdingsDeleteChain)
    const holdingsUpsert = vi.fn().mockResolvedValue({ error: null })

    mockFromImpl = (table) => {
      if (table === 'silos') {
        const selectChain = eqChain({ data: { id: 'silo-1', platform_type: 'alpaca' }, error: null })
        const siloUpdate = plainUpdateChain()
        return {
          select: vi.fn().mockReturnValue(selectChain),
          update: vi.fn().mockReturnValue(siloUpdate),
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
      if (table === 'holdings') {
        return {
          select: vi.fn().mockReturnValue(selectEqChain([])),
          delete: holdingsDelete,
          upsert: holdingsUpsert,
        }
      }
      if (table === 'asset_mappings') {
        return {
          select: vi.fn().mockReturnValue(selectEqChain([])),
          upsert: vi.fn().mockResolvedValue({ error: null }),
          delete: vi.fn().mockReturnValue(deleteEqChain()),
        }
      }
      if (table === 'target_weights') {
        return {
          select: vi.fn().mockReturnValue(selectEqChain([])),
          delete: vi.fn().mockReturnValue(deleteEqChain()),
        }
      }
      return {}
    }

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cash: '300.00' }),
      })

    const [req, ctx] = makeRequest()
    const res = await POST(req, ctx)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.holdings_updated).toBe(0)
    expect(holdingsDelete).toHaveBeenCalledTimes(1)
    expect(holdingsDeleteChain.eq).toHaveBeenCalledWith('silo_id', 'silo-uuid-1')
    expect(holdingsUpsert).not.toHaveBeenCalled()
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
        return {
          select: vi.fn().mockReturnValue(selectEqChain([])),
          upsert: vi.fn().mockResolvedValue({ error: null }),
          delete: vi.fn().mockReturnValue(deleteEqChain()),
        }
      }
      if (table === 'holdings') {
        const selectChain = selectEqChain([])
        const upd: Record<string, unknown> = {}
        upd.eq = vi.fn().mockReturnValue(upd)
        Object.assign(upd, Promise.resolve({ error: null }))
        const delChain: Record<string, unknown> = {}
        delChain.eq = vi.fn().mockReturnValue(delChain)
        delChain.neq = vi.fn().mockReturnValue(delChain)
        Object.assign(delChain, Promise.resolve({ error: null }))
        return {
          select: vi.fn().mockReturnValue(selectChain),
          upsert: vi.fn().mockResolvedValue({ error: null }),
          delete: vi.fn().mockReturnValue(delChain),
          update: vi.fn().mockReturnValue(upd),
        }
      }
      if (table === 'price_cache_fresh') {
        // Return stale so fetchPrice tries Finnhub
        return { select: vi.fn().mockReturnValue(eqChain({ data: null, error: null })) }
      }
      if (table === 'price_cache') {
        return { upsert: vi.fn().mockResolvedValue({ error: null }) }
      }
      if (table === 'target_weights') {
        return {
          select: vi.fn().mockReturnValue(selectEqChain([])),
          delete: vi.fn().mockReturnValue(deleteEqChain()),
        }
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

// ── Schwab sync tests — STORY-015b ───────────────────────────────────────────

describe('POST /api/silos/:silo_id/sync — Schwab branch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  })

  function makeSchwabSiloMock(profileData: Record<string, unknown>) {
    return (table: string) => {
      if (table === 'silos') {
        const selectChain = eqChain({ data: { id: 'silo-1', platform_type: 'schwab' }, error: null })
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
        const ins = { select: vi.fn().mockReturnValue(singleChain({ id: 'asset-uuid-s1' })) }
        return { select: vi.fn().mockReturnValue(mb), insert: vi.fn().mockReturnValue(ins) }
      }
      if (table === 'asset_mappings') {
        return {
          select: vi.fn().mockReturnValue(selectEqChain([])),
          upsert: vi.fn().mockResolvedValue({ error: null }),
          delete: vi.fn().mockReturnValue(deleteEqChain()),
        }
      }
      if (table === 'holdings') {
        const upd: Record<string, unknown> = {}
        upd.eq = vi.fn().mockReturnValue(upd)
        Object.assign(upd, Promise.resolve({ error: null }))
        const delChain: Record<string, unknown> = {}
        delChain.eq = vi.fn().mockReturnValue(delChain)
        delChain.neq = vi.fn().mockReturnValue(delChain)
        delChain.in = vi.fn().mockReturnValue(delChain)
        Object.assign(delChain, Promise.resolve({ error: null }))
        return {
          select: vi.fn().mockReturnValue(selectEqChain([])),
          upsert: vi.fn().mockResolvedValue({ error: null }),
          delete: vi.fn().mockReturnValue(delChain),
          update: vi.fn().mockReturnValue(upd),
        }
      }
      if (table === 'target_weights') {
        return {
          select: vi.fn().mockReturnValue(selectEqChain([])),
          delete: vi.fn().mockReturnValue(deleteEqChain()),
        }
      }
      return {}
    }
  }

  it('returns 403 SCHWAB_NOT_CONNECTED when no Schwab tokens are stored', async () => {
    mockFromImpl = makeSchwabSiloMock({
      schwab_access_enc: null,
      schwab_refresh_enc: null,
      schwab_token_expires: null,
    })
    const [req, ctx] = makeRequest()
    const res = await POST(req, ctx)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('SCHWAB_NOT_CONNECTED')
  })

  it('returns 401 SCHWAB_TOKEN_EXPIRED when token_expires is in the past (AC1)', async () => {
    const pastDate = new Date(Date.now() - 60_000).toISOString()
    mockFromImpl = makeSchwabSiloMock({
      schwab_access_enc: MOCK_SCHWAB_ACCESS_ENC,
      schwab_refresh_enc: MOCK_SCHWAB_REFRESH_ENC,
      schwab_token_expires: pastDate,
    })
    const [req, ctx] = makeRequest()
    const res = await POST(req, ctx)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('SCHWAB_TOKEN_EXPIRED')
  })

  it('returns 503 BROKER_UNAVAILABLE when Schwab API is unreachable', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    mockFromImpl = makeSchwabSiloMock({
      schwab_access_enc: MOCK_SCHWAB_ACCESS_ENC,
      schwab_refresh_enc: MOCK_SCHWAB_REFRESH_ENC,
      schwab_token_expires: futureDate,
    })
    mockFetch.mockRejectedValue(new Error('Network error'))
    const [req, ctx] = makeRequest()
    const res = await POST(req, ctx)
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('BROKER_UNAVAILABLE')
  })

  it('returns 401 SCHWAB_TOKEN_EXPIRED when Schwab API returns 401 (access token expired mid-window)', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    mockFromImpl = makeSchwabSiloMock({
      schwab_access_enc: MOCK_SCHWAB_ACCESS_ENC,
      schwab_refresh_enc: MOCK_SCHWAB_REFRESH_ENC,
      schwab_token_expires: futureDate,
    })
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
    const [req, ctx] = makeRequest()
    const res = await POST(req, ctx)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('SCHWAB_TOKEN_EXPIRED')
  })

  it('returns 200 with holdings_updated and platform=schwab on success (AC2, AC3)', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    mockFromImpl = makeSchwabSiloMock({
      schwab_access_enc: MOCK_SCHWAB_ACCESS_ENC,
      schwab_refresh_enc: MOCK_SCHWAB_REFRESH_ENC,
      schwab_token_expires: futureDate,
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        {
          securitiesAccount: {
            positions: [
              { instrument: { symbol: 'AAPL', assetType: 'EQUITY' }, longQuantity: 10, shortQuantity: 0, costBasis: 1500 },
              { instrument: { symbol: 'MSFT', assetType: 'EQUITY' }, longQuantity: 5, shortQuantity: 0, costBasis: 2000 },
            ],
          },
        },
      ],
    })
    const [req, ctx] = makeRequest()
    const res = await POST(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.platform).toBe('schwab')
    expect(body.holdings_updated).toBe(2)
    expect(typeof body.synced_at).toBe('string')
  })

  it('returns 200 with holdings_updated=0 when Schwab account has no positions', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    mockFromImpl = makeSchwabSiloMock({
      schwab_access_enc: MOCK_SCHWAB_ACCESS_ENC,
      schwab_refresh_enc: MOCK_SCHWAB_REFRESH_ENC,
      schwab_token_expires: futureDate,
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [{ securitiesAccount: { positions: [] } }],
    })
    const [req, ctx] = makeRequest()
    const res = await POST(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.platform).toBe('schwab')
    expect(body.holdings_updated).toBe(0)
  })

  it('replaces stale Schwab holdings when a sold position disappears from the latest sync', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const holdingsDeleteChain = deleteEqChain()
    const holdingsDelete = vi.fn().mockReturnValue(holdingsDeleteChain)

    mockFromImpl = (table) => {
      if (table === 'silos') {
        const selectChain = eqChain({ data: { id: 'silo-1', platform_type: 'schwab' }, error: null })
        const upd = plainUpdateChain()
        return { select: vi.fn().mockReturnValue(selectChain), update: vi.fn().mockReturnValue(upd) }
      }
      if (table === 'user_profiles') {
        return {
          select: vi.fn().mockReturnValue(eqChain({
            data: {
              schwab_access_enc: MOCK_SCHWAB_ACCESS_ENC,
              schwab_refresh_enc: MOCK_SCHWAB_REFRESH_ENC,
              schwab_token_expires: futureDate,
            },
            error: null,
          })),
        }
      }
      if (table === 'assets') {
        return { select: vi.fn().mockReturnValue(selectEqChain({ id: 'asset-aapl' })) }
      }
      if (table === 'asset_mappings') {
        return {
          select: vi.fn().mockReturnValue(selectEqChain([])),
          upsert: vi.fn().mockResolvedValue({ error: null }),
          delete: vi.fn().mockReturnValue(deleteEqChain()),
        }
      }
      if (table === 'holdings') {
        return {
          select: vi.fn().mockReturnValue(selectEqChain([])),
          delete: holdingsDelete,
          upsert: vi.fn().mockResolvedValue({ error: null }),
        }
      }
      if (table === 'target_weights') {
        return {
          select: vi.fn().mockReturnValue(selectEqChain([])),
          delete: vi.fn().mockReturnValue(deleteEqChain()),
        }
      }
      return {}
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        {
          securitiesAccount: {
            positions: [
              { instrument: { symbol: 'AAPL', assetType: 'EQUITY' }, longQuantity: 10, shortQuantity: 0, costBasis: 1500 },
            ],
          },
        },
      ],
    })

    const [req, ctx] = makeRequest()
    const res = await POST(req, ctx)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.holdings_updated).toBe(1)
    expect(holdingsDelete).toHaveBeenCalledTimes(1)
    expect(holdingsDeleteChain.eq).toHaveBeenCalledWith('silo_id', 'silo-uuid-1')
  })
})

// ── Webull sync tests — STORY-016 ─────────────────────────────────────────────

describe('POST /api/silos/:silo_id/sync — Webull branch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  })

  function makeWebullSiloMock(profileData: Record<string, unknown>) {
    return (table: string) => {
      if (table === 'silos') {
        const selectChain = eqChain({ data: { id: 'silo-1', platform_type: 'webull' }, error: null })
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
        const ins = { select: vi.fn().mockReturnValue(singleChain({ id: 'asset-uuid-w1' })) }
        return { select: vi.fn().mockReturnValue(mb), insert: vi.fn().mockReturnValue(ins) }
      }
      if (table === 'asset_mappings') {
        return {
          select: vi.fn().mockReturnValue(selectEqChain([])),
          upsert: vi.fn().mockResolvedValue({ error: null }),
          delete: vi.fn().mockReturnValue(deleteEqChain()),
        }
      }
      if (table === 'holdings') {
        const upd: Record<string, unknown> = {}
        upd.eq = vi.fn().mockReturnValue(upd)
        Object.assign(upd, Promise.resolve({ error: null }))
        const delChain: Record<string, unknown> = {}
        delChain.eq = vi.fn().mockReturnValue(delChain)
        delChain.neq = vi.fn().mockReturnValue(delChain)
        delChain.in = vi.fn().mockReturnValue(delChain)
        Object.assign(delChain, Promise.resolve({ error: null }))
        return {
          select: vi.fn().mockReturnValue(selectEqChain([])),
          upsert: vi.fn().mockResolvedValue({ error: null }),
          delete: vi.fn().mockReturnValue(delChain),
          update: vi.fn().mockReturnValue(upd),
        }
      }
      if (table === 'target_weights') {
        return {
          select: vi.fn().mockReturnValue(selectEqChain([])),
          delete: vi.fn().mockReturnValue(deleteEqChain()),
        }
      }
      return {}
    }
  }

  it('returns 403 WEBULL_NOT_CONNECTED when no Webull keys are stored', async () => {
    mockFromImpl = makeWebullSiloMock({ webull_key_enc: null, webull_secret_enc: null })
    const [req, ctx] = makeRequest()
    const res = await POST(req, ctx)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('WEBULL_NOT_CONNECTED')
  })

  it('returns 503 BROKER_UNAVAILABLE when Webull API is unreachable', async () => {
    mockFromImpl = makeWebullSiloMock({
      webull_key_enc: MOCK_WEBULL_KEY_ENC,
      webull_secret_enc: MOCK_WEBULL_SECRET_ENC,
    })
    mockFetch.mockRejectedValue(new Error('Network error'))
    const [req, ctx] = makeRequest()
    const res = await POST(req, ctx)
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('BROKER_UNAVAILABLE')
  })

  it('returns 200 with holdings_updated and platform=webull on success', async () => {
    mockFromImpl = makeWebullSiloMock({
      webull_key_enc: MOCK_WEBULL_KEY_ENC,
      webull_secret_enc: MOCK_WEBULL_SECRET_ENC,
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { ticker: { symbol: 'AAPL', type: 'US_STOCK' }, position: '10.000000', costPrice: '150.000000' },
          { ticker: { symbol: 'MSFT', type: 'US_STOCK' }, position: '5.000000', costPrice: '200.000000' },
        ],
      }),
    })
    const [req, ctx] = makeRequest()
    const res = await POST(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.platform).toBe('webull')
    expect(body.holdings_updated).toBe(2)
    expect(typeof body.synced_at).toBe('string')
  })

  it('returns 200 with holdings_updated=0 when Webull account has no positions', async () => {
    mockFromImpl = makeWebullSiloMock({
      webull_key_enc: MOCK_WEBULL_KEY_ENC,
      webull_secret_enc: MOCK_WEBULL_SECRET_ENC,
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    })
    const [req, ctx] = makeRequest()
    const res = await POST(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.platform).toBe('webull')
    expect(body.holdings_updated).toBe(0)
  })
})
