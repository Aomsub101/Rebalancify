# TS.2.2 — Supabase Client Layer

## Task
Create browser-side and server-side Supabase client utilities.

## Target
`lib/supabase/`

## Inputs
- TS.2.1 outputs (Next.js scaffold)
- TS.1.1 outputs (Supabase credentials in `.env.local`)

## Process
1. Create `lib/supabase/client.ts`:
   - Browser-side client using `createBrowserClient` from `@supabase/ssr`
   - Reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. Create `lib/supabase/server.ts`:
   - Server-side client using `createServerClient` from `@supabase/ssr`
   - Uses `cookies()` from `next/headers` for session management
   - Used by all API route handlers
3. Create `lib/supabase/middleware.ts`:
   - Middleware-compatible client for JWT refresh in middleware.ts
4. Export typed Supabase client (generate types from schema later)

## Outputs
- `lib/supabase/client.ts` — browser client
- `lib/supabase/server.ts` — server client
- `lib/supabase/middleware.ts` — middleware client

## Verify
- Browser client can query public tables (e.g., `assets`)
- Server client can query with service role
- Both clients respect RLS based on JWT

## Handoff
→ TS.2.3 (auth pages use these clients)
