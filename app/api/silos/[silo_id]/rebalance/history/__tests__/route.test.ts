/**
 * Integration tests for GET /api/silos/:silo_id/rebalance/history
 *
 * Required cases:
 *   1. Unauthenticated → 401
 *   2. Silo not found (wrong user) → 404
 *   3. No sessions → 200 { data: [], page: 1, limit: 20, total: 0 }
 *   4. Sessions with orders returned newest-first
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

const mockGetUser = vi.fn()
let mockFromImpl: (table: string) => unknown = () => ({})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => mockFromImpl(table)),
  })),
}))

import { GET } from '../route'

// ── Request factory ─────────────────────────────────────────────────────────

function makeRequest(
  siloId = 'silo-uuid-1',
  query: Record<string, string> = {},
): [import('next/server').NextRequest, { params: Promise<{ silo_id: string }> }] {
  const url = new URL(`http://localhost/api/silos/${siloId}/rebalance/history`)
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
  const req = new Request(url.toString()) as import('next/server').NextRequest
  return [req, { params: Promise.resolve({ silo_id: siloId }) }]
}

// ── Supabase chain helpers ───────────────────────────────────────────────────

function singleChain(data: unknown, err: unknown = null) {
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.eq = () => chain
  chain.single = () => ({ data, error: err })
  return chain
}

function selectChain(
  data: unknown[],
  count: number | null = null,
  err: unknown = null,
) {
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.eq = () => chain
  chain.order = () => chain
  chain.range = () => ({ data, error: err, count })
  return chain
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/silos/:silo_id/rebalance/history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── 1. Unauthenticated ───────────────────────────────────────────────────

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('no session') })
    const [req, ctx] = makeRequest()
    const res = await GET(req, ctx)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  // ── 2. Silo not found ────────────────────────────────────────────────────

  it('returns 404 when silo does not belong to the user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockFromImpl = (table) => {
      if (table === 'silos') return singleChain(null)
      return {}
    }
    const [req, ctx] = makeRequest('bad-silo')
    const res = await GET(req, ctx)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  // ── 3. No sessions ───────────────────────────────────────────────────────

  it('returns 200 with empty data when no sessions exist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockFromImpl = (table) => {
      if (table === 'silos') {
        return singleChain({ id: 'silo-1', user_id: 'user-1' })
      }
      if (table === 'rebalance_sessions') {
        return selectChain([], 0)
      }
      return {}
    }
    const [req, ctx] = makeRequest('silo-1')
    const res = await GET(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
    expect(body.total).toBe(0)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(20)
  })

  // ── 4. Sessions returned with orders, newest first ───────────────────────

  it('returns 200 with sessions and orders ordered newest first', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    const sessions = [
      {
        id: 'sess-2',
        mode: 'partial',
        created_at: '2026-03-28T12:00:00Z',
        status: 'approved',
        rebalance_orders: [{ id: 'o3', execution_status: 'executed' }],
      },
      {
        id: 'sess-1',
        mode: 'full',
        created_at: '2026-03-27T10:00:00Z',
        status: 'cancelled',
        rebalance_orders: [],
      },
    ]

    mockFromImpl = (table) => {
      if (table === 'silos') {
        return singleChain({ id: 'silo-1', user_id: 'user-1' })
      }
      if (table === 'rebalance_sessions') {
        return selectChain(sessions, 2)
      }
      return {}
    }

    const [req, ctx] = makeRequest('silo-1')
    const res = await GET(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(2)
    expect(body.data).toHaveLength(2)
    // First item is the response mapping of sess-2
    expect(body.data[0].session_id).toBe('sess-2')
    expect(body.data[0].mode).toBe('partial')
    expect(body.data[0].status).toBe('approved')
    expect(body.data[0].orders).toHaveLength(1)
    expect(body.data[0].orders[0].execution_status).toBe('executed')
    // Second item is sess-1
    expect(body.data[1].session_id).toBe('sess-1')
    expect(body.data[1].orders).toHaveLength(0)
  })

  // ── 5. Pagination params respected ──────────────────────────────────────

  it('respects page and limit query params', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    let capturedRange: [number, number] | null = null

    mockFromImpl = (table) => {
      if (table === 'silos') {
        return singleChain({ id: 'silo-1', user_id: 'user-1' })
      }
      if (table === 'rebalance_sessions') {
        const chain: Record<string, unknown> = {}
        chain.select = () => chain
        chain.eq = () => chain
        chain.order = () => chain
        chain.range = (from: number, to: number) => {
          capturedRange = [from, to]
          return { data: [], error: null, count: 50 }
        }
        return chain
      }
      return {}
    }

    const [req, ctx] = makeRequest('silo-1', { page: '3', limit: '10' })
    const res = await GET(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.page).toBe(3)
    expect(body.limit).toBe(10)
    expect(body.total).toBe(50)
    // page 3, limit 10 → offset 20, end 29
    expect(capturedRange).toEqual([20, 29])
  })
})
