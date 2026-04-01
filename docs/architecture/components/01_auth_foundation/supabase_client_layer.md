# Sub-Component: Supabase Client Layer

## 1. The Goal

Provide two purpose-built Supabase client singletons — one for browser-side React components and one for server-side API routes and Server Components — that share the same project credentials but use the appropriate cookie/storage strategy for their execution environment.

---

## 2. The Problem It Solves

Supabase's standard client creates a new instance per call. Without a module-level singleton pattern, React's strict mode and hot-module replacement would create duplicate clients, causing duplicate subscriptions and race conditions in auth state. Additionally, browser and server environments handle session storage differently: browsers use cookies automatically; server components must explicitly use Next.js's `cookies()` API. Two separate factory functions solve both problems cleanly.

---

## 3. The Proposed Solution / Underlying Concept

### Browser Client (`lib/supabase/client.ts`)

```typescript
// Creates a single browser-client singleton via createBrowserClient
// Uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY env vars
```

**Key facts from implementation:**
- Uses `createBrowserClient` from `@supabase/ssr`
- No cookie management needed — the browser client auto-manages JWT in `localStorage`
- Singleton exported as a plain function (not a React hook) — components call `createClient()` directly
- Exported name: `createClient` (named export)

### Server Client (`lib/supabase/server.ts`)

```typescript
// Creates a server-client singleton via createServerClient
// Uses Next.js cookies() API for cookie read/write
```

**Key facts from implementation:**
- Uses `createServerClient` from `@supabase/ssr`
- Awaits `cookies()` from `next/headers` to get the cookie store
- `setAll` has a try/catch that swallows errors when called from a Server Component context (middleware handles the actual session refresh in those cases)
- `getAll` reads all cookies synchronously from the already-awaited store
- Singleton exported as an `async` function named `createClient`

### Environment Variables Required

| Variable | Where Used |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Both clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Both clients |

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Browser client in SSR | `pnpm build` — browser client must not be imported in Server Components |
| Server client in browser | No `cookies()` call in browser context — verified by build |
| Auth state persists | Login → hard refresh → session still valid |
| Multiple component instances | Import `createClient` in two components — only one subscription active (checked via network tab) |
| `pnpm test` | `lib/supabase/__tests__/client.test.ts` and `server.test.ts` pass |
