# TS.2.4 — Auth Middleware

## Task
Protect all `(dashboard)` routes — redirect unauthenticated users to `/login`.

## Target
`middleware.ts`

## Inputs
- TS.2.2 outputs (middleware Supabase client)
- `docs/architecture/components/01_auth_foundation/auth_middleware.md`

## Process
1. Create `middleware.ts` at project root:
   - Match all `/(dashboard)/*` routes
   - Create Supabase middleware client
   - Call `supabase.auth.getUser()` to validate JWT
   - If no valid session: `NextResponse.redirect('/login')`
   - If valid session: `NextResponse.next()` (allow through)
   - Also refresh JWT if close to expiry (Supabase SSR handles this)
2. Configure `matcher` in `middleware.ts` config:
   ```typescript
   export const config = {
     matcher: ['/(dashboard)/:path*']
   }
   ```
3. Ensure `/login`, `/signup`, `/reset-password` are NOT matched (public routes)

## Outputs
- `middleware.ts` — JWT validation + redirect

## Verify
- Access `/overview` without session → redirected to `/login`
- Access `/overview` with valid JWT → page loads
- Access `/login` without session → page loads (no redirect loop)

## Handoff
→ Sprint 3 (AppShell layout)
