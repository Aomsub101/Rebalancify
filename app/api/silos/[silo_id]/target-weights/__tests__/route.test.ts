import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PUT } from '../route'
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
const ASSET_A = 'asset-a'
const ASSET_B = 'asset-b'

function makeParams() {
  return { params: Promise.resolve({ silo_id: SILO_ID }) }
}

function makeSiloMock(data: { id: string } | null = { id: SILO_ID }) {
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

function makeWeightsMock(data: unknown[] = []) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data, error: null }),
    }),
  }
}

function makeDeleteMock() {
  return {
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  }
}

function makeInsertMock(error: unknown = null) {
  return {
    insert: vi.fn().mockResolvedValue({ error }),
  }
}

function makeWeightsWithAssetsMock(data: unknown[] = []) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data, error: null }),
    }),
  }
}

// ─── GET ────────────────────────────────────────────────────────────────────

describe('GET /api/silos/[silo_id]/target-weights', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/target-weights`)
    const res = await GET(req, makeParams())
    expect(res.status).toBe(401)
  })

  it('returns 404 when silo not found / not owned (RLS — AC8)', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null })
    mockFrom.mockReturnValueOnce(makeSiloMock(null))
    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/target-weights`)
    const res = await GET(req, makeParams())
    expect(res.status).toBe(404)
  })

  it('returns 200 with weights, sum, cash_target, and no warning when sum = 100 (AC4)', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null })
    mockFrom
      .mockReturnValueOnce(makeSiloMock())
      .mockReturnValueOnce(makeWeightsWithAssetsMock([
        { asset_id: ASSET_A, weight_pct: '60.000', assets: { ticker: 'AAPL' } },
        { asset_id: ASSET_B, weight_pct: '40.000', assets: { ticker: 'BTC' } },
      ]))

    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/target-weights`)
    const res = await GET(req, makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.weights_sum_pct).toBeCloseTo(100, 3)
    expect(body.cash_target_pct).toBeCloseTo(0, 3)
    expect(body.sum_warning).toBe(false)
    expect(body.weights).toHaveLength(2)
    expect(body.weights[0].ticker).toBe('AAPL')
    expect(body.weights[0].weight_pct).toBeCloseTo(60, 3)
  })

  it('returns 200 with sum_warning: true and correct cash_target when sum ≠ 100 (AC3)', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null })
    mockFrom
      .mockReturnValueOnce(makeSiloMock())
      .mockReturnValueOnce(makeWeightsWithAssetsMock([
        { asset_id: ASSET_A, weight_pct: '50.000', assets: { ticker: 'AAPL' } },
        { asset_id: ASSET_B, weight_pct: '45.000', assets: { ticker: 'BTC' } },
      ]))

    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/target-weights`)
    const res = await GET(req, makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.weights_sum_pct).toBeCloseTo(95, 3)
    expect(body.cash_target_pct).toBeCloseTo(5, 3)
    expect(body.sum_warning).toBe(true)
  })

  it('returns 200 with empty weights array when no rows exist', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null })
    mockFrom
      .mockReturnValueOnce(makeSiloMock())
      .mockReturnValueOnce(makeWeightsWithAssetsMock([]))

    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/target-weights`)
    const res = await GET(req, makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.weights).toHaveLength(0)
    expect(body.weights_sum_pct).toBeCloseTo(0, 3)
    expect(body.sum_warning).toBe(false)
  })
})

// ─── PUT ────────────────────────────────────────────────────────────────────

describe('PUT /api/silos/[silo_id]/target-weights', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/target-weights`, {
      method: 'PUT',
      body: JSON.stringify({ weights: [] }),
    })
    const res = await PUT(req, makeParams())
    expect(res.status).toBe(401)
  })

  it('returns 404 when silo not owned — RLS isolation (AC8)', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null })
    mockFrom.mockReturnValueOnce(makeSiloMock(null))
    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/target-weights`, {
      method: 'PUT',
      body: JSON.stringify({ weights: [{ asset_id: ASSET_A, weight_pct: 50 }] }),
    })
    const res = await PUT(req, makeParams())
    expect(res.status).toBe(404)
  })

  it('returns 422 when weight_pct > 100 (AC2)', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null })
    mockFrom.mockReturnValueOnce(makeSiloMock())
    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/target-weights`, {
      method: 'PUT',
      body: JSON.stringify({ weights: [{ asset_id: ASSET_A, weight_pct: 101 }] }),
    })
    const res = await PUT(req, makeParams())
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_WEIGHT')
  })

  it('returns 422 when weight_pct < 0 (AC2)', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null })
    mockFrom.mockReturnValueOnce(makeSiloMock())
    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/target-weights`, {
      method: 'PUT',
      body: JSON.stringify({ weights: [{ asset_id: ASSET_A, weight_pct: -1 }] }),
    })
    const res = await PUT(req, makeParams())
    expect(res.status).toBe(422)
  })

  it('returns 200 with sum_warning: true when weights sum to 95 (AC3)', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null })
    mockFrom
      .mockReturnValueOnce(makeSiloMock())
      .mockReturnValueOnce(makeDeleteMock())
      .mockReturnValueOnce(makeInsertMock())
      .mockReturnValueOnce(makeWeightsWithAssetsMock([
        { asset_id: ASSET_A, weight_pct: '50.000', assets: { ticker: 'AAPL' } },
        { asset_id: ASSET_B, weight_pct: '45.000', assets: { ticker: 'BTC' } },
      ]))

    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/target-weights`, {
      method: 'PUT',
      body: JSON.stringify({
        weights: [
          { asset_id: ASSET_A, weight_pct: 50 },
          { asset_id: ASSET_B, weight_pct: 45 },
        ],
      }),
    })
    const res = await PUT(req, makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.sum_warning).toBe(true)
    expect(body.cash_target_pct).toBeCloseTo(5, 3)
    expect(body.weights_sum_pct).toBeCloseTo(95, 3)
  })

  it('returns 200 with sum_warning: false when weights sum to exactly 100 (AC4)', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null })
    mockFrom
      .mockReturnValueOnce(makeSiloMock())
      .mockReturnValueOnce(makeDeleteMock())
      .mockReturnValueOnce(makeInsertMock())
      .mockReturnValueOnce(makeWeightsWithAssetsMock([
        { asset_id: ASSET_A, weight_pct: '60.000', assets: { ticker: 'AAPL' } },
        { asset_id: ASSET_B, weight_pct: '40.000', assets: { ticker: 'BTC' } },
      ]))

    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/target-weights`, {
      method: 'PUT',
      body: JSON.stringify({
        weights: [
          { asset_id: ASSET_A, weight_pct: 60 },
          { asset_id: ASSET_B, weight_pct: 40 },
        ],
      }),
    })
    const res = await PUT(req, makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.sum_warning).toBe(false)
    expect(body.cash_target_pct).toBeCloseTo(0, 3)
  })

  it('returns 200 with sum_warning: false for empty weights array (all cash)', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null })
    mockFrom
      .mockReturnValueOnce(makeSiloMock())
      .mockReturnValueOnce(makeDeleteMock())
      .mockReturnValueOnce(makeWeightsWithAssetsMock([]))

    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/target-weights`, {
      method: 'PUT',
      body: JSON.stringify({ weights: [] }),
    })
    const res = await PUT(req, makeParams())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.weights).toHaveLength(0)
    expect(body.weights_sum_pct).toBeCloseTo(0, 3)
    // 0 weights, 0 holdings — sum_warning only when holdings exist and sum ≠ 100
    expect(body.sum_warning).toBe(false)
  })

  it('returns 400 for invalid JSON body', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null })
    mockFrom.mockReturnValueOnce(makeSiloMock())
    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/target-weights`, {
      method: 'PUT',
      body: 'not-json',
    })
    const res = await PUT(req, makeParams())
    expect(res.status).toBe(400)
  })
})
