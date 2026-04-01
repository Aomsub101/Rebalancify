# Sub-Component: Auth Middleware

## 1. The Goal

Intercept every HTTP request at the edge before it reaches any page or API route. Enforce authentication: unauthenticated users trying to access protected dashboard routes are redirected to `/login`, and already-authenticated users hitting auth routes (`/login`, `/signup`, `/reset-password`) are redirected to `/overview`.

---

## 2. The Problem It Solves

Without middleware-level route guards, protected pages would need individual auth checks, leading to inconsistent implementations and brief unauthenticated content flashes before redirects. The middleware runs at the edge before any rendering, closing this gap. It also handles the E2E test bypass mechanism used in CI/Playwright tests.

---

## 3. The Proposed Solution / Underlying Concept

### Implementation: `middleware.ts` (root of project)

Uses `createServerClient` from `@supabase/ssr` with a custom cookie adapter that reads from the incoming `NextRequest` and writes to the outgoing `NextResponse`.

### Route Classification

```typescript
const AUTH_ROUTES = ['/login', '/signup', '/reset-password', '/auth']

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((route) => pathname.startsWith(route))
}
```

### Decision Logic

```
Request arrives
    │
    ├── Has E2E_BYPASS cookie = '1'?  →  Allow through immediately
    │
    ├── No user + not an auth route  →  Redirect to /login
    │
    ├── Has user + is an auth route  →  Redirect to /overview
    │
    └── Otherwise  →  Allow through (NextResponse.next())
```

### E2E Test Bypass

```typescript
const bypassCookie = request.cookies.get('E2E_BYPASS')
if (bypassCookie && bypassCookie.value === '1') {
  return supabaseResponse
}
```

This cookie is set by Playwright tests so that the auth flow can be tested end-to-end without a real Supabase instance interfering.

### Matcher Configuration

```typescript
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

All paths are matched EXCEPT static files and images, ensuring no public asset bypasses auth checks.

### Session Refresh

`await supabase.auth.getUser()` is called immediately after `createServerClient` — no logic is placed between these two calls. This is the Supabase-recommended pattern to ensure the session JWT is always fresh.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Unauthenticated `/overview` → `/login` | `curl -I http://localhost:3000/overview` (no cookie) → 302 to /login |
| Authenticated `/login` → `/overview` | Login → `curl -I -b cookies.txt http://localhost:3000/login` → 302 to /overview |
| Static files bypass middleware | `curl -I http://localhost:3000/_next/static/...` → 200 (no redirect) |
| E2E bypass cookie works | Set `E2E_BYPASS=1` cookie → access `/overview` without auth → 200 |
| No logic between client creation and getUser() | Code review: `createServerClient` call is immediately followed by `getUser()` |
| `pnpm build` | Middleware compiles without errors |
