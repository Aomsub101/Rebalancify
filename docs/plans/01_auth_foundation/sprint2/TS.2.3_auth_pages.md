# TS.2.3 — Auth Pages

## Task
Build login, signup, and reset-password pages using Supabase Auth.

## Target
`app/(auth)/`

## Inputs
- TS.2.2 outputs (Supabase client layer)
- `docs/architecture/components/01_auth_foundation/auth_pages.md`

## Process
1. Create `app/(auth)/login/page.tsx`:
   - Email + password form (no `<form>` tag — PWA compat, use `onClick` handler)
   - Call `supabase.auth.signInWithPassword()`
   - On success: redirect to `/overview`
   - On error: show inline error message
   - "Don't have an account?" link to `/signup`
   - "Forgot password?" link to `/reset-password`
2. Create `app/(auth)/signup/page.tsx`:
   - Email + password + confirm password form
   - Call `supabase.auth.signUp()`
   - On success: show "Check your email for verification" message
   - Password requirements: min 8 characters
3. Create `app/(auth)/reset-password/page.tsx`:
   - Email input
   - Call `supabase.auth.resetPasswordForEmail()`
   - Show "Check your email" confirmation
4. Style all pages with Tailwind — centered card layout, consistent branding

## Outputs
- `app/(auth)/login/page.tsx`
- `app/(auth)/signup/page.tsx`
- `app/(auth)/reset-password/page.tsx`

## Verify
- Full flow: signup → email verify → login → redirect to `/overview`
- Invalid credentials show error message
- Reset password email received

## Handoff
→ TS.2.4 (middleware protects dashboard routes)
