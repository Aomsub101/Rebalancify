import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from '../route'
import { NextRequest } from 'next/server'

// ── Helpers for chaining Supabase mock returns ────────────────────────────────

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

function makeSiloMock(data: { id: string; drift_threshold: number; platform_type: string } | null = { id: SILO_ID, drift_threshold: 5.0, platform_type: 'manual' }) {
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

function makeAssetMock(data: { ticker: string; price_source: string } | null = { ticker: 'AAPL', price_source: 'finnhub' }) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error: null }),
      }),
    }),
  }
}

function makePriceCacheMock(exists: boolean = false) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: exists ? { asset_id: ASSET_ID } : null,
          error: null,
        }),
      }),
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
      .mockReturnValueOnce(makeAssetMock())
      .mockReturnValueOnce(makePriceCacheMock(false))

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

  it('returns 400 when asset_id is missing', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null })
    mockFrom.mockReturnValueOnce(makeSiloMock())
    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/holdings`, {
      method: 'POST',
      body: JSON.stringify({ quantity: '10.00000000' }), // no asset_id
    })
    const res = await POST(req, makeParams())
    expect(res.status).toBe(400)
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
      .mockReturnValueOnce(makeAssetMock())
      .mockReturnValueOnce(makePriceCacheMock(false))

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

// ── GET /api/silos/[silo_id]/holdings — Platform isolation ─────────────────────

/**
 * Platform isolation is enforced in the GET handler:
 *   - API silos (alpaca, bitkub, innovestx, schwab, webull): only return holdings
 *     where source = '${platform_type}_sync'
 *   - Manual silos: return ALL holdings regardless of source
 *
 * This prevents holdings from one broker bleeding into another's silo view.
 * See: app/api/silos/[silo_id]/holdings/route.ts lines 45-50.
 */

describe('GET /api/silos/[silo_id]/holdings — Platform isolation', () => {
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

  it('filters holdings by source for API silos — Alpaca silo only returns alpaca_sync holdings', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null })

    const alpacaHolding = {
      id: 'h-alpaca',
      asset_id: 'asset-alpaca',
      quantity: '10.00000000',
      source: 'alpaca_sync',
      last_updated_at: new Date().toISOString(),
      assets: { ticker: 'TSLA', name: 'Tesla Inc.', asset_type: 'stock' },
    }
    const manualHolding = {
      id: 'h-manual',
      asset_id: 'asset-manual',
      quantity: '5.00000000',
      source: 'manual',
      last_updated_at: new Date().toISOString(),
      assets: { ticker: 'AAPL', name: 'Apple Inc.', asset_type: 'stock' },
    }
    // DB contains BOTH an Alpaca-sourced and a manual holding for the same silo
    const allHoldings = [alpacaHolding, manualHolding]
    const priceData = [
      { asset_id: 'asset-alpaca', price: '250.00000000', currency: 'USD' },
      { asset_id: 'asset-manual', price: '185.00000000', currency: 'USD' },
    ]
    const weightData = [
      { asset_id: 'asset-alpaca', weight_pct: 50 },
      { asset_id: 'asset-manual', weight_pct: 50 },
    ]

    // platform_type='alpaca' triggers source filtering in GET handler
    mockFrom
      .mockReturnValueOnce(makeSiloMock({ id: SILO_ID, platform_type: 'alpaca', drift_threshold: 5 }))
      .mockReturnValueOnce(makeHoldingsMock(allHoldings))
      .mockReturnValueOnce(makePriceMock(priceData))
      .mockReturnValueOnce(makeTargetWeightsMock(weightData))

    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/holdings`)
    const res = await GET(req, makeParams())
    expect(res.status).toBe(200)
    const body = await res.json()
    // Platform isolation enforced: only alpaca_sync holdings returned
    expect(body.holdings).toHaveLength(1)
    expect(body.holdings[0].source).toBe('alpaca_sync')
    expect(body.holdings[0].ticker).toBe('TSLA')
    // Manual holding (AAPL) must NOT appear in Alpaca silo
    expect(body.holdings.some((h: { ticker: string }) => h.ticker === 'AAPL')).toBe(false)
  })

  it('returns ALL holdings for manual silos — no source filtering', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: USER_ID } }, error: null })

    const alpacaHolding = {
      id: 'h-alpaca',
      asset_id: 'asset-alpaca',
      quantity: '10.00000000',
      source: 'alpaca_sync',
      last_updated_at: new Date().toISOString(),
      assets: { ticker: 'TSLA', name: 'Tesla Inc.', asset_type: 'stock' },
    }
    const manualHolding = {
      id: 'h-manual',
      asset_id: 'asset-manual',
      quantity: '5.00000000',
      source: 'manual',
      last_updated_at: new Date().toISOString(),
      assets: { ticker: 'AAPL', name: 'Apple Inc.', asset_type: 'stock' },
    }
    const bitkubHolding = {
      id: 'h-bitkub',
      asset_id: 'asset-bitkub',
      quantity: '0.50000000',
      source: 'bitkub_sync',
      last_updated_at: new Date().toISOString(),
      assets: { ticker: 'BTC', name: 'Bitcoin', asset_type: 'crypto' },
    }
    const allHoldings = [alpacaHolding, manualHolding, bitkubHolding]
    const priceData = [
      { asset_id: 'asset-alpaca', price: '250.00000000', currency: 'USD' },
      { asset_id: 'asset-manual', price: '185.00000000', currency: 'USD' },
      { asset_id: 'asset-bitkub', price: '60000.00000000', currency: 'THB' },
    ]
    const weightData = [
      { asset_id: 'asset-alpaca', weight_pct: 40 },
      { asset_id: 'asset-manual', weight_pct: 30 },
      { asset_id: 'asset-bitkub', weight_pct: 30 },
    ]

    // platform_type='manual' → no source filtering in GET handler
    mockFrom
      .mockReturnValueOnce(makeSiloMock({ id: SILO_ID, platform_type: 'manual', drift_threshold: 5 }))
      .mockReturnValueOnce(makeHoldingsMock(allHoldings))
      .mockReturnValueOnce(makePriceMock(priceData))
      .mockReturnValueOnce(makeTargetWeightsMock(weightData))

    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/holdings`)
    const res = await GET(req, makeParams())
    expect(res.status).toBe(200)
    const body = await res.json()
    // Manual silo: no source filtering — all sources returned
    expect(body.holdings).toHaveLength(3)
    const sources = body.holdings.map((h: { source: string }) => h.source)
    expect(sources).toContain('alpaca_sync')
    expect(sources).toContain('manual')
    expect(sources).toContain('bitkub_sync')
  })
})
