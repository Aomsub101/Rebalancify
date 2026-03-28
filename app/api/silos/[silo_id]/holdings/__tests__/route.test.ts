import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from '../route'
import { NextRequest } from 'next/server'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

const SILO_ID = 'silo-1'
const USER_ID = 'user-1'
const ASSET_ID = 'asset-1'
const HOLDING_ID = 'holding-1'

function makeParams() {
  return { params: Promise.resolve({ silo_id: SILO_ID }) }
}

function makeSiloMock(data = { id: SILO_ID, drift_threshold: 5.0, platform_type: 'manual' }) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data, error: null }),
          }),
        }),
      }),
    }),
  }
}

function makeHoldingsMock(data: unknown[] = []) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data, error: null }),
    }),
  }
}

function makePriceMock(data: unknown[] = []) {
  return {
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data, error: null }),
    }),
  }
}

function makeTargetWeightsMock(data: unknown[] = []) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data, error: null }),
    }),
  }
}

const HOLDING_ROW = {
  id: HOLDING_ID,
  asset_id: ASSET_ID,
  quantity: '10.00000000',
  cost_basis: '1500.00000000',
  cash_balance: '0.00000000',
  source: 'manual',
  last_updated_at: new Date().toISOString(),
  assets: { ticker: 'AAPL', name: 'Apple Inc.', asset_type: 'stock' },
}

describe('GET /api/silos/[silo_id]/holdings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/holdings`)
    const res = await GET(req, makeParams())
    expect(res.status).toBe(401)
  })

  it('returns 404 when silo not found', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null })
    mockFrom.mockReturnValueOnce(makeSiloMock(null))
    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/holdings`)
    const res = await GET(req, makeParams())
    expect(res.status).toBe(404)
  })

  it('returns 200 with computed derived values', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null })
    mockFrom
      .mockReturnValueOnce(makeSiloMock())
      .mockReturnValueOnce(makeHoldingsMock([HOLDING_ROW]))
      .mockReturnValueOnce(makePriceMock([{ asset_id: ASSET_ID, price: '185.20000000', currency: 'USD' }]))
      .mockReturnValueOnce(makeTargetWeightsMock([{ asset_id: ASSET_ID, weight_pct: 20.000 }]))

    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/holdings`)
    const res = await GET(req, makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.holdings).toHaveLength(1)
    const h = body.holdings[0]
    expect(h.ticker).toBe('AAPL')
    expect(h.current_value).toBe('1852.00000000')
    expect(h.current_weight_pct).toBeCloseTo(100, 1)
    expect(h.target_weight_pct).toBeCloseTo(20, 1)
    expect(h.drift_pct).toBeCloseTo(80, 1)
    expect(h.drift_breached).toBe(true)
    expect(h.stale_days).toBe(0)
    expect(body.drift_threshold).toBe(5.0)
    expect(body.total_value).toBe('1852.00000000')
  })

  it('returns 200 with empty holdings array', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null })
    mockFrom
      .mockReturnValueOnce(makeSiloMock())
      .mockReturnValueOnce(makeHoldingsMock([]))
      .mockReturnValueOnce(makePriceMock([]))
      .mockReturnValueOnce(makeTargetWeightsMock([]))

    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/holdings`)
    const res = await GET(req, makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.holdings).toHaveLength(0)
    expect(body.total_value).toBe('0.00000000')
  })
})

describe('POST /api/silos/[silo_id]/holdings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/holdings`, {
      method: 'POST',
      body: JSON.stringify({ asset_id: ASSET_ID, quantity: '10.00000000' }),
    })
    const res = await POST(req, makeParams())
    expect(res.status).toBe(401)
  })

  it('returns 404 when silo not owned', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null })
    mockFrom.mockReturnValueOnce(makeSiloMock(null))
    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/holdings`, {
      method: 'POST',
      body: JSON.stringify({ asset_id: ASSET_ID, quantity: '10.00000000' }),
    })
    const res = await POST(req, makeParams())
    expect(res.status).toBe(404)
  })

  it('returns 201 with created holding', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null })
    const upsertFn = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: HOLDING_ID, asset_id: ASSET_ID, silo_id: SILO_ID,
            quantity: '10.00000000', cost_basis: '1500.00000000',
            cash_balance: '0.00000000', source: 'manual',
            last_updated_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    })
    mockFrom
      .mockReturnValueOnce(makeSiloMock())
      .mockReturnValueOnce({ upsert: upsertFn })

    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/holdings`, {
      method: 'POST',
      body: JSON.stringify({
        asset_id: ASSET_ID,
        quantity: '10.00000000',
        cost_basis: '1500.00000000',
      }),
    })
    const res = await POST(req, makeParams())
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body.id).toBe(HOLDING_ID)
  })

  it('ignores price field in request body (AC2)', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null })
    const upsertFn = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: HOLDING_ID, asset_id: ASSET_ID, quantity: '10.00000000' },
          error: null,
        }),
      }),
    })
    mockFrom
      .mockReturnValueOnce(makeSiloMock())
      .mockReturnValueOnce({ upsert: upsertFn })

    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/holdings`, {
      method: 'POST',
      body: JSON.stringify({
        asset_id: ASSET_ID,
        quantity: '10.00000000',
        price: '999.99',
      }),
    })
    await POST(req, makeParams())

    const upsertArg = upsertFn.mock.calls[0][0]
    expect(upsertArg).not.toHaveProperty('price')
  })
})
