import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from '../route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/priceService', () => ({
  fetchPrice: vi.fn().mockResolvedValue({
    price: '185.20000000', currency: 'USD', source: 'finnhub', fromCache: false,
  }),
}))

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
const ASSET_ID = 'asset-uuid-1'
const MAPPING_ID = 'mapping-uuid-1'

const AUTHED = { data: { user: { id: USER_ID } }, error: null }
const UNAUTHED = { data: { user: null }, error: null }

function makeParams() {
  return { params: Promise.resolve({ silo_id: SILO_ID }) }
}

function postBody(overrides = {}) {
  return JSON.stringify({
    ticker: 'AAPL',
    name: 'Apple Inc.',
    asset_type: 'stock',
    price_source: 'finnhub',
    local_label: 'AAPL',
    ...overrides,
  })
}

describe('GET /api/silos/[silo_id]/asset-mappings', () => {
  beforeEach(() => { vi.clearAllMocks(); mockGetUser.mockResolvedValue(AUTHED) })

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValueOnce(UNAUTHED)
    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/asset-mappings`)
    const res = await GET(req, makeParams())
    expect(res.status).toBe(401)
  })

  it('returns 200 with mappings array', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    })
    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/asset-mappings`)
    const res = await GET(req, makeParams())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})

describe('POST /api/silos/[silo_id]/asset-mappings', () => {
  beforeEach(() => { vi.clearAllMocks(); mockGetUser.mockResolvedValue(AUTHED) })

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValueOnce(UNAUTHED)
    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/asset-mappings`, {
      method: 'POST', body: postBody(),
    })
    const res = await POST(req, makeParams())
    expect(res.status).toBe(401)
  })

  it('returns 404 when silo not found or not owned by user', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    })
    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/asset-mappings`, {
      method: 'POST', body: postBody(),
    })
    const res = await POST(req, makeParams())
    expect(res.status).toBe(404)
  })

  it('returns 201 with asset_id, mapping_id, ticker on success', async () => {
    mockFrom
      // 1. silo ownership check
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: SILO_ID }, error: null }),
              }),
            }),
          }),
        }),
      })
      // 2. upsert asset
      .mockReturnValueOnce({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: ASSET_ID, ticker: 'AAPL' }, error: null }),
          }),
        }),
      })
      // 3. check existing mapping → none
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      })
      // 4. insert mapping
      .mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: MAPPING_ID, asset_id: ASSET_ID }, error: null,
            }),
          }),
        }),
      })
      // 5. holdings upsert (best-effort)
      .mockReturnValueOnce({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      })

    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/asset-mappings`, {
      method: 'POST', body: postBody(),
    })
    const res = await POST(req, makeParams())
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.asset_id).toBe(ASSET_ID)
    expect(body.mapping_id).toBe(MAPPING_ID)
    expect(body.ticker).toBe('AAPL')
  })

  it('returns 409 ASSET_MAPPING_EXISTS when mapping already exists', async () => {
    mockFrom
      // 1. silo ownership check
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: SILO_ID }, error: null }),
              }),
            }),
          }),
        }),
      })
      // 2. upsert asset
      .mockReturnValueOnce({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: ASSET_ID, ticker: 'AAPL' }, error: null }),
          }),
        }),
      })
      // 3. check existing mapping → found
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'existing-mapping', asset_id: ASSET_ID }, error: null,
              }),
            }),
          }),
        }),
      })

    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/asset-mappings`, {
      method: 'POST', body: postBody(),
    })
    const res = await POST(req, makeParams())
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error.code).toBe('ASSET_MAPPING_EXISTS')
  })

  it('returns 400 for missing required fields', async () => {
    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/asset-mappings`, {
      method: 'POST',
      body: JSON.stringify({ ticker: 'AAPL' }), // missing name, asset_type, etc.
    })
    const res = await POST(req, makeParams())
    expect(res.status).toBe(400)
  })
})
