import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
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
const ASSET_1 = 'asset-1'
const ASSET_2 = 'asset-2'

function makeParams() {
  return { params: Promise.resolve({ silo_id: SILO_ID }) }
}

function makeSiloMock(
  data: { id: string; drift_threshold: string } | null = { id: SILO_ID, drift_threshold: '5.00' }
) {
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

function makeWeightsMock(data: unknown[] = []) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data, error: null }),
    }),
  }
}

const HOLDING_1 = {
  asset_id: ASSET_1,
  quantity: '10.00000000',
  cash_balance: '0.00000000',
  assets: { ticker: 'AAPL', name: 'Apple Inc.' },
}

const HOLDING_2 = {
  asset_id: ASSET_2,
  quantity: '5.00000000',
  cash_balance: '0.00000000',
  assets: { ticker: 'BTC', name: 'Bitcoin' },
}

describe('GET /api/silos/[silo_id]/drift', () => {
  beforeEach(() => vi.clearAllMocks())

  // AC8: RLS — unauthenticated
  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/drift`)
    const res = await GET(req, makeParams())
    expect(res.status).toBe(401)
  })

  // AC8: RLS — other user's silo returns 404
  it('returns 404 when silo not owned by user', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null })
    mockFrom.mockReturnValueOnce(makeSiloMock(null))
    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/drift`)
    const res = await GET(req, makeParams())
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  // AC7: live computation — nothing stored
  it('returns 200 with silo_id and computed_at', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null })
    mockFrom
      .mockReturnValueOnce(makeSiloMock())
      .mockReturnValueOnce(makeHoldingsMock([]))
      .mockReturnValueOnce(makePriceMock([]))
      .mockReturnValueOnce(makeWeightsMock([]))
    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/drift`)
    const res = await GET(req, makeParams())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.silo_id).toBe(SILO_ID)
    expect(body.drift_threshold).toBe(5.0)
    expect(body.computed_at).toBeDefined()
    expect(body.assets).toHaveLength(0)
  })

  // AC1 + AC2 + AC3: green state (within threshold)
  it('returns green drift_state when ABS(drift_pct) <= threshold', async () => {
    // AAPL: price=100, qty=10 → value=1000. BTC: price=500, qty=1 → value=500.
    // total=1500. AAPL weight=66.667, target=65 → drift=+1.667 → green (abs<=5)
    const holdings = [
      { ...HOLDING_1, quantity: '10.00000000' },
      { asset_id: ASSET_2, quantity: '1.00000000', cash_balance: '0.00000000', assets: { ticker: 'BTC', name: 'Bitcoin' } },
    ]
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null })
    mockFrom
      .mockReturnValueOnce(makeSiloMock())
      .mockReturnValueOnce(makeHoldingsMock(holdings))
      .mockReturnValueOnce(makePriceMock([
        { asset_id: ASSET_1, price: '100.00000000' },
        { asset_id: ASSET_2, price: '500.00000000' },
      ]))
      .mockReturnValueOnce(makeWeightsMock([
        { asset_id: ASSET_1, weight_pct: '65.000' },
        { asset_id: ASSET_2, weight_pct: '33.000' },
      ]))

    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/drift`)
    const res = await GET(req, makeParams())
    const body = await res.json()
    expect(res.status).toBe(200)

    const aapl = body.assets.find((a: { ticker: string }) => a.ticker === 'AAPL')
    expect(aapl).toBeDefined()
    expect(aapl.drift_state).toBe('green')
    expect(aapl.drift_breached).toBe(false)
    // drift_pct should be positive (over-weight) and displayed with correct precision
    expect(aapl.drift_pct).toBeGreaterThan(0)
    expect(aapl.current_weight_pct).toBeCloseTo(66.667, 1)
    expect(aapl.target_weight_pct).toBe(65.0)
  })

  // AC3: yellow state (threshold < ABS <= threshold + 2)
  it('returns yellow drift_state when threshold < ABS <= threshold + 2', async () => {
    // Single asset: price=100, qty=10 → value=1000, total=1000, weight=100
    // target=94 → drift=+6 → yellow (5 < 6 <= 7)
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null })
    mockFrom
      .mockReturnValueOnce(makeSiloMock())
      .mockReturnValueOnce(makeHoldingsMock([HOLDING_1]))
      .mockReturnValueOnce(makePriceMock([{ asset_id: ASSET_1, price: '100.00000000' }]))
      .mockReturnValueOnce(makeWeightsMock([{ asset_id: ASSET_1, weight_pct: '94.000' }]))

    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/drift`)
    const res = await GET(req, makeParams())
    const body = await res.json()
    const aapl = body.assets.find((a: { ticker: string }) => a.ticker === 'AAPL')
    expect(aapl.drift_state).toBe('yellow')
    expect(aapl.drift_breached).toBe(true)
    expect(aapl.drift_pct).toBeCloseTo(6, 1)
  })

  // AC3: red state (ABS > threshold + 2)
  it('returns red drift_state when ABS > threshold + 2', async () => {
    // Single asset: price=100, qty=10 → weight=100, target=90 → drift=+10 → red
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null })
    mockFrom
      .mockReturnValueOnce(makeSiloMock())
      .mockReturnValueOnce(makeHoldingsMock([HOLDING_1]))
      .mockReturnValueOnce(makePriceMock([{ asset_id: ASSET_1, price: '100.00000000' }]))
      .mockReturnValueOnce(makeWeightsMock([{ asset_id: ASSET_1, weight_pct: '90.000' }]))

    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/drift`)
    const res = await GET(req, makeParams())
    const body = await res.json()
    const aapl = body.assets.find((a: { ticker: string }) => a.ticker === 'AAPL')
    expect(aapl.drift_state).toBe('red')
    expect(aapl.drift_breached).toBe(true)
  })

  // AC4: custom threshold
  it('uses silo drift_threshold from DB (custom threshold = 2)', async () => {
    // drift=+3 → with threshold=2: 2 < 3 <= 4 → yellow
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null })
    mockFrom
      .mockReturnValueOnce(makeSiloMock({ id: SILO_ID, drift_threshold: '2.00' }))
      .mockReturnValueOnce(makeHoldingsMock([HOLDING_1]))
      .mockReturnValueOnce(makePriceMock([{ asset_id: ASSET_1, price: '100.00000000' }]))
      .mockReturnValueOnce(makeWeightsMock([{ asset_id: ASSET_1, weight_pct: '97.000' }]))

    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/drift`)
    const res = await GET(req, makeParams())
    const body = await res.json()
    expect(body.drift_threshold).toBe(2.0)
    const aapl = body.assets.find((a: { ticker: string }) => a.ticker === 'AAPL')
    expect(aapl.drift_state).toBe('yellow')
  })

  // AC5: drift_pct has correct sign
  it('drift_pct is negative when holding is under-weight', async () => {
    // weight=100, target=110 → drift=-10
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null })
    mockFrom
      .mockReturnValueOnce(makeSiloMock())
      .mockReturnValueOnce(makeHoldingsMock([HOLDING_1]))
      .mockReturnValueOnce(makePriceMock([{ asset_id: ASSET_1, price: '100.00000000' }]))
      .mockReturnValueOnce(makeWeightsMock([{ asset_id: ASSET_1, weight_pct: '110.000' }]))

    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/drift`)
    const res = await GET(req, makeParams())
    const body = await res.json()
    const aapl = body.assets.find((a: { ticker: string }) => a.ticker === 'AAPL')
    expect(aapl.drift_pct).toBeLessThan(0)
    expect(aapl.drift_state).toBe('red')
  })
})
