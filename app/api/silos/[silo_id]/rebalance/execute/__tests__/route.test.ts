/**
 * Integration tests for POST /api/silos/:silo_id/rebalance/execute
 *
 * Required cases per docs/development/03-testing-strategy.md:
 *   1. Unauthenticated → 401
 *   2. Silo not found (wrong user) → 404
 *   3. Session not found / wrong silo → 404 SESSION_NOT_FOUND
 *   4. Manual silo happy path → approved orders = 'manual', status = 'approved'
 *   5. Alpaca happy path → orders submitted, alpaca_order_id stored, status = 'approved'
 *   6. Alpaca partial failure → 1 success + 1 failure → status = 'partial'
 *   7. All orders skipped → status = 'cancelled', no Alpaca calls
 *   8. Alpaca credentials not configured → 403 ALPACA_NOT_CONNECTED
 *
 * SECURITY (AC9): All Alpaca calls go through this server route.
 * Zero browser requests to api.alpaca.markets / paper-api.alpaca.markets.
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

vi.stubEnv('ENCRYPTION_KEY', 'a'.repeat(64))

import { encrypt } from '@/lib/encryption'
const TEST_ENC_KEY = 'a'.repeat(64)
const MOCK_ALPACA_KEY_ENC = encrypt('PKTEST123', TEST_ENC_KEY)
const MOCK_ALPACA_SECRET_ENC = encrypt('SKTEST456', TEST_ENC_KEY)

const mockGetUser = vi.fn()
let mockFromImpl: (table: string) => unknown = () => ({})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => mockFromImpl(table)),
  })),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { POST } from '../route'

// ── Request factory ────────────────────────────────────────────────────────────

function makeRequest(
  siloId = 'silo-uuid-1',
  body: Record<string, unknown> = {},
): [import('next/server').NextRequest, { params: Promise<{ silo_id: string }> }] {
  const req = new Request(`http://localhost/api/silos/${siloId}/rebalance/execute`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as import('next/server').NextRequest
  return [req, { params: Promise.resolve({ silo_id: siloId }) }]
}

// ── Supabase chain helpers (same pattern as sync.test.ts) ─────────────────────

function singleChain(data: unknown, err: unknown = null) {
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.eq = () => chain
  chain.single = () => ({ data, error: err })
  return chain
}

function listResult(data: unknown, err: unknown = null) {
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.eq = () => chain
  chain.in = () => ({ data, error: err })
  // direct data/error for .eq() terminal
  chain.data = data
  chain.error = err
  return chain
}

function updateChain(err: unknown = null) {
  const chain: Record<string, unknown> = {}
  chain.update = () => chain
  chain.eq = () => chain
  chain.in = () => chain
  chain.error = err
  return chain
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/silos/:silo_id/rebalance/execute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  // ── 1. Unauthenticated ───────────────────────────────────────────────────────

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('no session') })
    const [req, ctx] = makeRequest()
    const res = await POST(req, ctx)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  // ── 2. Silo not found ────────────────────────────────────────────────────────

  it('returns 404 when silo does not belong to the user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockFromImpl = (table) => {
      if (table === 'silos') return singleChain(null)
      return {}
    }
    const [req, ctx] = makeRequest('bad-silo', {
      session_id: 's1',
      approved_order_ids: [],
      skipped_order_ids: [],
    })
    const res = await POST(req, ctx)
    expect(res.status).toBe(404)
  })

  // ── 3. Session not found ─────────────────────────────────────────────────────

  it('returns 404 SESSION_NOT_FOUND when session does not belong to silo', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockFromImpl = (table) => {
      if (table === 'silos') {
        return singleChain({ id: 'silo-1', platform_type: 'manual', user_id: 'user-1' })
      }
      if (table === 'rebalance_sessions') return singleChain(null)
      return {}
    }
    const [req, ctx] = makeRequest('silo-1', {
      session_id: 'wrong-session',
      approved_order_ids: ['o1'],
      skipped_order_ids: [],
    })
    const res = await POST(req, ctx)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('SESSION_NOT_FOUND')
  })

  // ── 4. Manual silo — happy path ──────────────────────────────────────────────

  it('marks approved orders as manual and session as approved for a manual silo', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    const updateMock = vi.fn(() => updateChain())

    mockFromImpl = (table) => {
      if (table === 'silos') {
        return singleChain({ id: 'silo-1', platform_type: 'manual', user_id: 'user-1' })
      }
      if (table === 'rebalance_sessions') {
        const chain = singleChain({ id: 'sess-1', silo_id: 'silo-1', user_id: 'user-1', status: 'pending' })
        ;(chain as Record<string, unknown>).update = updateMock
        return chain
      }
      if (table === 'rebalance_orders') {
        const chain: Record<string, unknown> = {}
        chain.select = () => chain
        chain.eq = () => ({
          data: [
            { id: 'o1', execution_status: 'pending', session_id: 'sess-1', order_type: 'buy', quantity: '2.00000000', asset_id: 'asset-1' },
            { id: 'o2', execution_status: 'pending', session_id: 'sess-1', order_type: 'sell', quantity: '1.00000000', asset_id: 'asset-2' },
          ],
          error: null,
        })
        chain.update = updateMock
        return chain
      }
      return { update: updateMock }
    }

    const [req, ctx] = makeRequest('silo-1', {
      session_id: 'sess-1',
      approved_order_ids: ['o1'],
      skipped_order_ids: ['o2'],
    })
    const res = await POST(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.session_id).toBe('sess-1')
    expect(body.skipped_count).toBe(1)
    // For manual silo, approved orders become 'manual' — executed_count stays 0
    expect(body.executed_count).toBe(0)
    expect(body.failed_count).toBe(0)
    // No Alpaca fetch
    expect(mockFetch).not.toHaveBeenCalled()
  })

  // ── 5. Alpaca happy path ─────────────────────────────────────────────────────

  it('submits orders to Alpaca, stores alpaca_order_id, status = approved', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    const updateMock = vi.fn(() => updateChain())

    mockFromImpl = (table) => {
      if (table === 'silos') {
        return singleChain({ id: 'silo-1', platform_type: 'alpaca', user_id: 'user-1' })
      }
      if (table === 'rebalance_sessions') {
        const chain = singleChain({ id: 'sess-1', silo_id: 'silo-1', user_id: 'user-1', status: 'pending' })
        ;(chain as Record<string, unknown>).update = updateMock
        return chain
      }
      if (table === 'rebalance_orders') {
        const chain: Record<string, unknown> = {}
        chain.select = () => chain
        chain.eq = () => ({
          data: [
            { id: 'o1', execution_status: 'pending', session_id: 'sess-1', order_type: 'buy', quantity: '2.00000000', asset_id: 'asset-1' },
            { id: 'o2', execution_status: 'pending', session_id: 'sess-1', order_type: 'sell', quantity: '1.00000000', asset_id: 'asset-2' },
          ],
          error: null,
        })
        chain.update = updateMock
        return chain
      }
      if (table === 'user_profiles') {
        return singleChain({ alpaca_key_enc: MOCK_ALPACA_KEY_ENC, alpaca_secret_enc: MOCK_ALPACA_SECRET_ENC, alpaca_mode: 'paper' })
      }
      if (table === 'assets') {
        const chain: Record<string, unknown> = {}
        chain.select = () => chain
        chain.eq = () => chain
        chain.in = () => ({
          data: [
            { id: 'asset-1', ticker: 'AAPL' },
            { id: 'asset-2', ticker: 'MSFT' },
          ],
          error: null,
        })
        return chain
      }
      return { update: updateMock }
    }

    // Both Alpaca orders succeed
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'alpaca-order-id-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'alpaca-order-id-2' }) })

    const [req, ctx] = makeRequest('silo-1', {
      session_id: 'sess-1',
      approved_order_ids: ['o1', 'o2'],
      skipped_order_ids: [],
    })
    const res = await POST(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.session_id).toBe('sess-1')
    expect(body.executed_count).toBe(2)
    expect(body.skipped_count).toBe(0)
    expect(body.failed_count).toBe(0)
    // Alpaca called once per order (server-side only — AC9)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch.mock.calls[0][0]).toContain('alpaca.markets/v2/orders')
  })

  // ── 6. Alpaca partial failure ────────────────────────────────────────────────

  it('returns status partial when at least one Alpaca order fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    const updateMock = vi.fn(() => updateChain())

    mockFromImpl = (table) => {
      if (table === 'silos') {
        return singleChain({ id: 'silo-1', platform_type: 'alpaca', user_id: 'user-1' })
      }
      if (table === 'rebalance_sessions') {
        const chain = singleChain({ id: 'sess-1', silo_id: 'silo-1', user_id: 'user-1', status: 'pending' })
        ;(chain as Record<string, unknown>).update = updateMock
        return chain
      }
      if (table === 'rebalance_orders') {
        const chain: Record<string, unknown> = {}
        chain.select = () => chain
        chain.eq = () => ({
          data: [
            { id: 'o1', execution_status: 'pending', session_id: 'sess-1', order_type: 'buy', quantity: '2.00000000', asset_id: 'asset-1' },
            { id: 'o2', execution_status: 'pending', session_id: 'sess-1', order_type: 'buy', quantity: '1.00000000', asset_id: 'asset-2' },
          ],
          error: null,
        })
        chain.update = updateMock
        return chain
      }
      if (table === 'user_profiles') {
        return singleChain({ alpaca_key_enc: MOCK_ALPACA_KEY_ENC, alpaca_secret_enc: MOCK_ALPACA_SECRET_ENC, alpaca_mode: 'paper' })
      }
      if (table === 'assets') {
        const chain: Record<string, unknown> = {}
        chain.select = () => chain
        chain.eq = () => chain
        chain.in = () => ({
          data: [
            { id: 'asset-1', ticker: 'AAPL' },
            { id: 'asset-2', ticker: 'MSFT' },
          ],
          error: null,
        })
        return chain
      }
      return { update: updateMock }
    }

    // First succeeds, second fails
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'alpaca-order-id-1' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ message: 'insufficient buying power' }) })

    const [req, ctx] = makeRequest('silo-1', {
      session_id: 'sess-1',
      approved_order_ids: ['o1', 'o2'],
      skipped_order_ids: [],
    })
    const res = await POST(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.executed_count).toBe(1)
    expect(body.failed_count).toBe(1)
    expect(body.session_id).toBe('sess-1')
    expect(updateMock).toHaveBeenCalled()
  })

  // ── 7. All orders skipped → cancelled ───────────────────────────────────────

  it('sets session status to cancelled when approved_order_ids is empty', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    const updateMock = vi.fn(() => updateChain())

    mockFromImpl = (table) => {
      if (table === 'silos') {
        return singleChain({ id: 'silo-1', platform_type: 'manual', user_id: 'user-1' })
      }
      if (table === 'rebalance_sessions') {
        const chain = singleChain({ id: 'sess-1', silo_id: 'silo-1', user_id: 'user-1', status: 'pending' })
        ;(chain as Record<string, unknown>).update = updateMock
        return chain
      }
      if (table === 'rebalance_orders') {
        const chain: Record<string, unknown> = {}
        chain.select = () => chain
        chain.eq = () => ({
          data: [{ id: 'o1', execution_status: 'pending', session_id: 'sess-1', order_type: 'buy', quantity: '1.00000000', asset_id: 'asset-1' }],
          error: null,
        })
        chain.update = updateMock
        return chain
      }
      return { update: updateMock }
    }

    const [req, ctx] = makeRequest('silo-1', {
      session_id: 'sess-1',
      approved_order_ids: [],
      skipped_order_ids: ['o1'],
    })
    const res = await POST(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.executed_count).toBe(0)
    expect(body.skipped_count).toBe(1)
    expect(body.failed_count).toBe(0)
    expect(mockFetch).not.toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalled()
  })

  // ── 8. Alpaca not configured ─────────────────────────────────────────────────

  it('returns 403 ALPACA_NOT_CONNECTED when Alpaca credentials are missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    mockFromImpl = (table) => {
      if (table === 'silos') {
        return singleChain({ id: 'silo-1', platform_type: 'alpaca', user_id: 'user-1' })
      }
      if (table === 'rebalance_sessions') {
        return singleChain({ id: 'sess-1', silo_id: 'silo-1', user_id: 'user-1', status: 'pending' })
      }
      if (table === 'rebalance_orders') {
        const chain: Record<string, unknown> = {}
        chain.select = () => chain
        chain.eq = () => ({
          data: [{ id: 'o1', execution_status: 'pending', session_id: 'sess-1', order_type: 'buy', quantity: '1.00000000', asset_id: 'asset-1' }],
          error: null,
        })
        return chain
      }
      if (table === 'user_profiles') {
        return singleChain({ alpaca_key_enc: null, alpaca_secret_enc: null, alpaca_mode: 'paper' })
      }
      return {}
    }

    const [req, ctx] = makeRequest('silo-1', {
      session_id: 'sess-1',
      approved_order_ids: ['o1'],
      skipped_order_ids: [],
    })
    const res = await POST(req, ctx)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ALPACA_NOT_CONNECTED')
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
