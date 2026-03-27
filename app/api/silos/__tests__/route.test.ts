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

/** Build a fully-chainable Supabase mock for a silo limit check.
 *  .select().eq().eq() → Promise<{ count, error }>
 */
function limitCheckChain(count: number) {
  const resolved = Promise.resolve({ count, error: null })
  const chain2 = { eq: vi.fn().mockReturnValue(resolved) }
  const chain1 = { eq: vi.fn().mockReturnValue(chain2) }
  return { select: vi.fn().mockReturnValue(chain1) }
}

/** Build a chain for GET /api/silos: .select().eq().eq().order() → data */
function siloListChain(silos: unknown[]) {
  const resolved = Promise.resolve({ data: silos, error: null })
  const chain3 = { order: vi.fn().mockReturnValue(resolved) }
  const chain2 = { eq: vi.fn().mockReturnValue(chain3) }
  const chain1 = { eq: vi.fn().mockReturnValue(chain2) }
  return { select: vi.fn().mockReturnValue(chain1) }
}

/** Count chain for the post-insert re-count: .select().eq().eq() → count */
const limitCountChain = (count: number) => limitCheckChain(count)

/** Build chain for INSERT: .insert().select().single() → data */
function insertChain(row: unknown) {
  const resolved = Promise.resolve({ data: row, error: null })
  const chain2 = { single: vi.fn().mockReturnValue(resolved) }
  const chain1 = { select: vi.fn().mockReturnValue(chain2) }
  return { insert: vi.fn().mockReturnValue(chain1) }
}

let fromCalls = 0
let mockFromImpl: (table: string) => unknown = () => ({})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      fromCalls++
      return mockFromImpl(table)
    }),
  })),
}))

import { GET, POST } from '../route'

function makePostRequest(body: unknown): Request {
  return new Request('http://localhost/api/silos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/silos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fromCalls = 0
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('no auth') })
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 200 with empty array when user has no active silos', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockFromImpl = () => siloListChain([])
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(0)
  })
})

describe('POST /api/silos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fromCalls = 0
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('no auth') })
    const res = await POST(makePostRequest({ name: 'Test', platform_type: 'alpaca' }))
    expect(res.status).toBe(401)
  })

  it('returns 422 SILO_LIMIT_REACHED when user already has 5 active silos', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    // checkSiloLimit → count = 5
    mockFromImpl = () => limitCheckChain(5)
    const res = await POST(
      makePostRequest({ name: 'Silo 6', platform_type: 'alpaca', base_currency: 'USD', drift_threshold: 5 }),
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('SILO_LIMIT_REACHED')
  })

  it('returns 400 when name is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    // count = 0 → limit not reached
    mockFromImpl = () => limitCheckChain(0)
    const res = await POST(makePostRequest({ platform_type: 'alpaca' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_VALUE')
  })

  it('returns 400 when platform_type is invalid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockFromImpl = () => limitCheckChain(0)
    const res = await POST(makePostRequest({ name: 'Test', platform_type: 'not_a_platform' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_VALUE')
  })

  it('returns 201 with new silo on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    const newSilo = {
      id: 'silo-new',
      user_id: 'u1',
      name: 'Test Silo',
      platform_type: 'alpaca',
      base_currency: 'USD',
      drift_threshold: 5,
      is_active: true,
      last_synced_at: null,
      created_at: '2026-03-27T00:00:00Z',
      updated_at: '2026-03-27T00:00:00Z',
    }

    let callIndex = 0
    mockFromImpl = () => {
      callIndex++
      if (callIndex === 1) return limitCheckChain(0)  // checkSiloLimit → 0
      if (callIndex === 2) return insertChain(newSilo) // INSERT
      return limitCountChain(1)                        // re-count after insert
    }

    const res = await POST(
      makePostRequest({ name: 'Test Silo', platform_type: 'alpaca', base_currency: 'USD', drift_threshold: 5 }),
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe('silo-new')
    expect(body.name).toBe('Test Silo')
    expect(body.silo_limit).toBe(5)
    expect(body.total_value).toBe('0.00000000')
  })
})
