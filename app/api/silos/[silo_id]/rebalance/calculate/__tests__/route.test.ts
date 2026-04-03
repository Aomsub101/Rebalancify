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

const mockFetchPrice = vi.fn()
vi.mock('@/lib/priceService', () => ({
  fetchPrice: (...args: unknown[]) => mockFetchPrice(...args),
}))

import { POST } from '../route'

function makeRequest(
  siloId = 'silo-1',
  body: Record<string, unknown> = {},
): [import('next/server').NextRequest, { params: Promise<{ silo_id: string }> }] {
  const req = new Request(`http://localhost/api/silos/${siloId}/rebalance/calculate`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as import('next/server').NextRequest
  return [req, { params: Promise.resolve({ silo_id: siloId }) }]
}

function singleChain(data: unknown, err: unknown = null) {
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.eq = () => chain
  chain.single = () => ({ data, error: err })
  return chain
}

function eqResultChain(data: unknown, err: unknown = null) {
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.eq = () => ({ data, error: err })
  return chain
}

function inResultChain(data: unknown, err: unknown = null) {
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.in = () => ({ data, error: err })
  return chain
}

function insertSingleChain(data: unknown, err: unknown = null) {
  const chain: Record<string, unknown> = {}
  chain.insert = () => chain
  chain.select = () => chain
  chain.single = () => ({ data, error: err })
  return chain
}

function insertListChain(data: unknown, err: unknown = null) {
  const chain: Record<string, unknown> = {}
  chain.insert = () => chain
  chain.select = () => ({ data, error: err })
  return chain
}

describe('POST /api/silos/:silo_id/rebalance/calculate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchPrice.mockReset()
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('no session') })
    const [req, ctx] = makeRequest()
    const res = await POST(req, ctx)
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid mode', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    const [req, ctx] = makeRequest('silo-1', { mode: 'bad-mode' })
    const res = await POST(req, ctx)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_MODE')
  })

  it('returns 404 when silo does not belong to the user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockFromImpl = (table) => {
      if (table === 'silos') return singleChain(null)
      return {}
    }
    const [req, ctx] = makeRequest()
    const res = await POST(req, ctx)
    expect(res.status).toBe(404)
  })

  it('returns 422 with session_id=null when full-mode preflight fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockFromImpl = (table) => {
      if (table === 'silos') return singleChain({ id: 'silo-1', user_id: 'user-1', cash_balance: '0.00000000' })
      if (table === 'holdings') {
        return eqResultChain([{ asset_id: 'asset-aapl', quantity: '1.00000000', assets: { ticker: 'AAPL' } }])
      }
      if (table === 'target_weights') {
        return eqResultChain([{ asset_id: 'asset-aapl', weight_pct: '100.000' }, { asset_id: 'asset-msft', weight_pct: '100.000' }])
      }
      if (table === 'price_cache') {
        return inResultChain([{ asset_id: 'asset-aapl', price: '1000.00000000' }, { asset_id: 'asset-msft', price: '1000.00000000' }])
      }
      if (table === 'assets') {
        return inResultChain([
          { id: 'asset-aapl', ticker: 'AAPL', price_source: 'finnhub' },
          { id: 'asset-msft', ticker: 'MSFT', price_source: 'finnhub' },
        ])
      }
      return {}
    }

    const [req, ctx] = makeRequest('silo-1', { mode: 'full' })
    const res = await POST(req, ctx)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.session_id).toBeNull()
    expect(body.balance_valid).toBe(false)
  })

  it('returns 200 with session_id and persisted orders on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockFromImpl = (table) => {
      if (table === 'silos') return singleChain({ id: 'silo-1', user_id: 'user-1', cash_balance: '1000.00000000' })
      if (table === 'holdings') {
        return eqResultChain([{ asset_id: 'asset-aapl', quantity: '1.00000000', assets: { ticker: 'AAPL' } }])
      }
      if (table === 'target_weights') {
        return eqResultChain([{ asset_id: 'asset-aapl', weight_pct: '50.000' }, { asset_id: 'asset-msft', weight_pct: '50.000' }])
      }
      if (table === 'price_cache') {
        return inResultChain([{ asset_id: 'asset-aapl', price: '100.00000000' }, { asset_id: 'asset-msft', price: '100.00000000' }])
      }
      if (table === 'assets') {
        return inResultChain([
          { id: 'asset-aapl', ticker: 'AAPL', price_source: 'finnhub' },
          { id: 'asset-msft', ticker: 'MSFT', price_source: 'finnhub' },
        ])
      }
      if (table === 'rebalance_sessions') return insertSingleChain({ id: 'sess-1' })
      if (table === 'rebalance_orders') {
        return insertListChain([
          {
            id: 'order-1',
            asset_id: 'asset-msft',
            order_type: 'buy',
            quantity: '5.00000000',
            estimated_value: '500.00000000',
            price_at_calc: '100.00000000',
            weight_before_pct: '0.000',
            weight_after_pct: '41.667',
          },
        ])
      }
      return {}
    }

    const [req, ctx] = makeRequest('silo-1', { mode: 'partial' })
    const res = await POST(req, ctx)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.session_id).toBe('sess-1')
    expect(Array.isArray(body.orders)).toBe(true)
    expect(body.orders[0].ticker).toBe('MSFT')
  })
})
