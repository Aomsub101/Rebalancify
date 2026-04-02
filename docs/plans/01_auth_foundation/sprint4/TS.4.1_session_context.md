# TS.4.1 — Session Context

## Task
Create SessionContext provider exposing session, profile, USD toggle, and silo count globally.

## Target
`contexts/SessionContext.tsx`

## Inputs
- `docs/architecture/components/01_auth_foundation/session_context.md`
- TS.3.1 outputs (AppShell wraps with this provider)

## Process
1. Create `contexts/SessionContext.tsx`:
   - Context value shape:
     ```typescript
     {
       session: Session | null
       profile: UserProfile | null
       siloCount: number
       setSiloCount: (n: number) => void
       showUsd: boolean
       setShowUsd: (v: boolean) => void
       isLoading: boolean
     }
     ```
   - On mount: fetch `GET /api/profile` via TanStack Query
   - Extract `siloCount`, `show_usd_toggle`, `notification_count` from profile
   - `setShowUsd` calls `PATCH /api/profile` with `{ show_usd_toggle: value }`
   - Listen for Supabase auth state changes (`onAuthStateChange`)
2. Create `hooks/useSession.ts` convenience hook:
   - `const { session, profile, showUsd, ... } = useSession()`
   - Throws if used outside SessionContext provider
3. Mount provider in `app/(dashboard)/layout.tsx`

## Outputs
- `contexts/SessionContext.tsx`
- `hooks/useSession.ts`

## Verify
- `useSession()` returns valid session after login
- `showUsd` toggle persists across page navigation
- `siloCount` updates when silos are created/deleted

## Handoff
→ TS.4.2 (Profile API)
