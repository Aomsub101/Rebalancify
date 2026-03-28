/**
 * Integration tests for GET /api/rebalance/history
 *
 * Required cases:
 *   1. Unauthenticated → 401
 *   2. No sessions → 200 { data: [], page: 1, limit: 20, total: 0 }
 *   3. Sessions across multiple silos, each with silo_name + silo_id (AC2)
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
  query: Record<string, string> = {},
): import('next/server').NextRequest {
  const url = new URL('http://localhost/api/rebalance/history')
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
  return new Request(url.toString()) as import('next/server').NextRequest
}

// ── Supabase chain helpers ───────────────────────────────────────────────────

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

describe('GET /api/rebalance/history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── 1. Unauthenticated ───────────────────────────────────────────────────

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('no session') })
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  // ── 2. No sessions ───────────────────────────────────────────────────────

  it('returns 200 with empty data when no sessions exist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockFromImpl = (table) => {
      if (table === 'rebalance_sessions') return selectChain([], 0)
      return {}
    }
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
    expect(body.total).toBe(0)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(20)
  })

  // ── 3. Sessions across multiple silos include silo_name + silo_id (AC2) ─

  it('returns sessions from multiple silos each with silo_name and silo_id', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

    const sessions = [
      {
        id: 'sess-2',
        silo_id: 'silo-b',
        mode: 'partial',
        created_at: '2026-03-28T12:00:00Z',
        status: 'approved',
        rebalance_orders: [{ id: 'o2', execution_status: 'executed' }],
        silos: { name: 'Crypto Silo' },
      },
      {
        id: 'sess-1',
        silo_id: 'silo-a',
        mode: 'full',
        created_at: '2026-03-27T10:00:00Z',
        status: 'cancelled',
        rebalance_orders: [],
        silos: { name: 'US Stocks' },
      },
    ]

    mockFromImpl = (table) => {
      if (table === 'rebalance_sessions') return selectChain(sessions, 2)
      return {}
    }

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(2)
    expect(body.data).toHaveLength(2)

    // First session
    expect(body.data[0].session_id).toBe('sess-2')
    expect(body.data[0].silo_id).toBe('silo-b')
    expect(body.data[0].silo_name).toBe('Crypto Silo')
    expect(body.data[0].orders).toHaveLength(1)

    // Second session
    expect(body.data[1].session_id).toBe('sess-1')
    expect(body.data[1].silo_id).toBe('silo-a')
    expect(body.data[1].silo_name).toBe('US Stocks')
    expect(body.data[1].orders).toHaveLength(0)
  })
})
