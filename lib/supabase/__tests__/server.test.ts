import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @supabase/ssr before importing the module under test
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({ auth: {}, from: vi.fn() })),
}))

// Mock next/headers — cookies() is async in Next.js 15
const mockGet = vi.fn()
const mockSet = vi.fn()
const mockGetAll = vi.fn(() => [] as Array<{ name: string; value: string }>)
const mockSetAll = vi.fn()

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: mockGet,
    set: mockSet,
    getAll: mockGetAll,
  })),
}))

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@/lib/supabase/server'

describe('lib/supabase/server', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')
  })

  it('calls createServerClient with the correct URL and anon key', async () => {
    await createClient()
    expect(createServerClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      })
    )
  })

  it('calls createServerClient exactly once per invocation', async () => {
    await createClient()
    expect(createServerClient).toHaveBeenCalledTimes(1)
  })

  it('returns the client returned by createServerClient', async () => {
    const mockClient = { auth: {}, from: vi.fn() }
    vi.mocked(createServerClient).mockReturnValueOnce(mockClient as ReturnType<typeof createServerClient>)
    const client = await createClient()
    expect(client).toBe(mockClient)
  })

  it('cookie handler getAll delegates to cookieStore.getAll', async () => {
    const expectedCookies = [{ name: 'sb-token', value: 'abc' }]
    mockGetAll.mockReturnValueOnce(expectedCookies)
    await createClient()

    // Extract the cookies handler passed to createServerClient
    const callArgs = vi.mocked(createServerClient).mock.calls[0]
    const cookieOptions = callArgs[2] as { cookies: { getAll: () => unknown } }
    const result = cookieOptions.cookies.getAll()
    expect(result).toEqual(expectedCookies)
  })

  it('cookie handler setAll calls cookieStore.set for each cookie', async () => {
    await createClient()

    const callArgs = vi.mocked(createServerClient).mock.calls[0]
    const cookieOptions = callArgs[2] as {
      cookies: {
        setAll: (
          cookies: Array<{ name: string; value: string; options?: object }>
        ) => void
      }
    }

    cookieOptions.cookies.setAll([
      { name: 'sb-access-token', value: 'token1', options: { path: '/' } },
      { name: 'sb-refresh-token', value: 'token2', options: { path: '/' } },
    ])

    expect(mockSet).toHaveBeenCalledTimes(2)
    expect(mockSet).toHaveBeenCalledWith('sb-access-token', 'token1', { path: '/' })
    expect(mockSet).toHaveBeenCalledWith('sb-refresh-token', 'token2', { path: '/' })
  })
})
