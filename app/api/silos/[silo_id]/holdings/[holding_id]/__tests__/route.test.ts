import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PATCH } from '../route'
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
const HOLDING_ID = 'holding-1'
const ASSET_ID = 'asset-1'

function makeParams() {
  return { params: Promise.resolve({ silo_id: SILO_ID, holding_id: HOLDING_ID }) }
}

const UPDATED_HOLDING = {
  id: HOLDING_ID,
  asset_id: ASSET_ID,
  silo_id: SILO_ID,
  quantity: '20.00000000',
  cost_basis: '3000.00000000',
  cash_balance: '0.00000000',
  source: 'manual',
  last_updated_at: new Date().toISOString(),
}

function makeUpdateMock(data: unknown) {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data, error: null }),
          }),
        }),
      }),
    }),
  }
}

describe('PATCH /api/silos/[silo_id]/holdings/[holding_id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/holdings/${HOLDING_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity: '20.00000000' }),
    })
    const res = await PATCH(req, makeParams())
    expect(res.status).toBe(401)
  })

  it('returns 404 when holding not found or not in silo', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null })
    mockFrom.mockReturnValueOnce(makeUpdateMock(null))
    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/holdings/${HOLDING_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity: '20.00000000' }),
    })
    const res = await PATCH(req, makeParams())
    expect(res.status).toBe(404)
  })

  it('returns 200 with updated holding on quantity change', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null })
    mockFrom.mockReturnValueOnce(makeUpdateMock(UPDATED_HOLDING))
    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/holdings/${HOLDING_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity: '20.00000000' }),
    })
    const res = await PATCH(req, makeParams())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.quantity).toBe('20.00000000')
  })

  it('always updates last_updated_at', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null })
    const updateFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: UPDATED_HOLDING, error: null }),
          }),
        }),
      }),
    })
    mockFrom.mockReturnValueOnce({ update: updateFn })
    const req = new NextRequest(`http://localhost/api/silos/${SILO_ID}/holdings/${HOLDING_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity: '20.00000000' }),
    })
    await PATCH(req, makeParams())
    const updatePayload = updateFn.mock.calls[0][0]
    expect(updatePayload).toHaveProperty('last_updated_at')
  })
})
