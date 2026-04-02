import { beforeEach, describe, expect, it, vi } from 'vitest'

const getUserMock = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: getUserMock,
    },
  })),
}))

vi.mock('next/server', () => {
  class MockNextUrl extends URL {
    clone() {
      return new MockNextUrl(this.toString())
    }
  }

  class MockNextRequest {
    nextUrl: MockNextUrl
    cookies = {
      get: vi.fn(() => undefined),
      getAll: vi.fn(() => []),
      set: vi.fn(),
    }

    constructor(input: string) {
      this.nextUrl = new MockNextUrl(input)
    }
  }

  const buildResponse = (status: number, location?: string) => {
    const headers = new Headers()
    if (location) {
      headers.set('location', location)
    }

    return {
      status,
      headers,
      cookies: {
        set: vi.fn(),
      },
    }
  }

  return {
    NextRequest: MockNextRequest,
    NextResponse: {
      next: vi.fn(() => buildResponse(200)),
      redirect: vi.fn((url: string | URL) => buildResponse(307, url.toString())),
    },
  }
})

describe('middleware', () => {
  beforeEach(() => {
    vi.resetModules()
    getUserMock.mockReset()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  })

  it('redirects unauthenticated page requests to /login', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })

    const { middleware } = await import('./middleware')
    const { NextRequest } = await import('next/server')

    const request = new NextRequest('http://localhost/overview')
    const response = await middleware(request as never)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/login')
  })

  it('does not redirect unauthenticated API requests', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })

    const { middleware } = await import('./middleware')
    const { NextRequest } = await import('next/server')

    const request = new NextRequest('http://localhost/api/backfill_debut')
    const response = await middleware(request as never)

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })
})
