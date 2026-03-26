import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @supabase/ssr before importing the module under test
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => ({ auth: {}, from: vi.fn() })),
}))

import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@/lib/supabase/client'

describe('lib/supabase/client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set required env vars
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')
  })

  it('calls createBrowserClient with the correct URL and anon key', () => {
    createClient()
    expect(createBrowserClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key'
    )
  })

  it('calls createBrowserClient exactly once per invocation', () => {
    createClient()
    expect(createBrowserClient).toHaveBeenCalledTimes(1)
  })

  it('returns the client returned by createBrowserClient', () => {
    const mockClient = { auth: {}, from: vi.fn() }
    vi.mocked(createBrowserClient).mockReturnValueOnce(mockClient as ReturnType<typeof createBrowserClient>)
    const client = createClient()
    expect(client).toBe(mockClient)
  })
})
