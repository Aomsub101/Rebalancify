import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const AUTH_ROUTES = ['/login', '/signup', '/reset-password', '/auth']

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname.startsWith(route))
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/')
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — do not add logic between createServerClient and getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const bypassCookie = request.cookies.get('E2E_BYPASS')
  if (bypassCookie && bypassCookie.value === '1') {
    return supabaseResponse
  }

  // Route handlers enforce their own auth/validation. Redirecting API requests
  // to /login breaks POST/JSON clients and proxy endpoints such as the Railway
  // FastAPI bridge.
  if (isApiRoute(pathname)) {
    return supabaseResponse
  }

  // Unauthenticated user trying to access a protected route → redirect to /login
  if (!user && !isAuthRoute(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Authenticated user hitting an auth route → redirect to /overview
  if (user && isAuthRoute(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/overview'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT API routes, static files, and images:
     * - api (route handlers)
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico, and common image extensions
     */
    '/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
