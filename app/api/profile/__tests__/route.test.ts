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
const mockProfileSelect = vi.fn()
const mockSiloCount = vi.fn()
const mockNotifCount = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn((table: string) => {
      if (table === 'user_profiles') return mockProfileSelect()
      if (table === 'silos') return mockSiloCount()
      if (table === 'notifications') return mockNotifCount()
      return {}
    }),
  })),
}))

import { GET, PATCH } from '../route'

const profileRow = {
  id: 'user-1',
  display_name: 'Alice',
  global_currency: 'USD',
  show_usd_toggle: false,
  drift_notif_channel: 'both',
  alpaca_key_enc: null,
  alpaca_secret_enc: null,
  alpaca_mode: 'paper',
  bitkub_key_enc: null,
  bitkub_secret_enc: null,
  innovestx_key_enc: null,
  innovestx_secret_enc: null,
  innovestx_digital_key_enc: null,
  innovestx_digital_secret_enc: null,
  schwab_access_enc: null,
  schwab_refresh_enc: null,
  schwab_token_expires: null,
  webull_key_enc: null,
  webull_secret_enc: null,
  llm_provider: null,
  llm_key_enc: null,
  llm_model: null,
  onboarded: false,
  progress_banner_dismissed: false,
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
}

function makeCountChain(count: number) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    // final eq call resolves with count
    mockResolvedValue: undefined,
  }
}

// Helper that creates a count chain where the last `.eq()` resolves
function countChain(count: number) {
  const chain = {
    select: vi.fn().mockReturnThis() as ReturnType<typeof vi.fn>,
    eq: vi.fn() as ReturnType<typeof vi.fn>,
  }
  chain.eq.mockReturnValueOnce(chain).mockResolvedValue({ count, error: null })
  return chain
}

describe('GET /api/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('no auth') })
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 200 with correct profile shape when authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockProfileSelect.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: profileRow, error: null }),
    })
    mockSiloCount.mockReturnValue(countChain(3))
    mockNotifCount.mockReturnValue(countChain(1))

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.id).toBe('user-1')
    expect(body.silo_limit).toBe(5)
    expect(body.active_silo_count).toBe(3)
    expect(body.notification_count).toBe(1)
    expect(body.alpaca_connected).toBe(false)
    // Ensure no _enc fields leak
    expect(JSON.stringify(body)).not.toContain('_enc')
  })
})

describe('PATCH /api/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('no auth') })
    const req = new Request('http://localhost/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: 'Bob' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when drift_notif_channel value is invalid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    const req = new Request('http://localhost/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drift_notif_channel: 'invalid_value' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_VALUE')
  })

  it('returns 400 when no updatable fields are provided', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    const req = new Request('http://localhost/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unknown_field: true }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('NO_FIELDS')
  })
})
