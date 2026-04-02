# Sub-Component: Auth Pages

## 1. The Goal

Provide three authenticated-facing auth pages — Login, Signup, and Reset Password — that allow users to create an account, sign in, and recover access. These pages are protected by middleware: authenticated users are redirected to `/overview` if they try to access them.

---

## 2. The Problem It Solves

New users need a path to create an account and existing users need a way to sign in. Users who forget their password need a self-service recovery path. Without these three pages, no user could ever access the authenticated parts of the application.

---

## 3. The Proposed Solution / Underlying Concept

### Shared Auth Layout (`app/(auth)/layout.tsx`)

A simple layout used exclusively by auth pages. It is minimal — no sidebar, no topbar, just a centred card on a clean background. It provides the structural boundary that separates auth routes from dashboard routes.

### Login Page (`app/(auth)/login/`)

**`LoginForm.tsx` — Controlled form with show/hide password toggle**

Form fields:
- Email (`type="email"`, `autoComplete="email"`)
- Password (`type="password"`, `autoComplete="current-password"` with show/hide toggle button)

Password show/hide: `type={showPassword ? 'text' : 'password'}` + `Eye`/`EyeOff` Lucide icons.

On submit:
1. Calls `supabase.auth.signInWithPassword({ email, password })`
2. On error: displays error message in a red alert box
3. On success: shows `toast.success('Logged in successfully')`, calls `router.push('/overview')`, and `router.refresh()`

"Sign up" and "Forgot password?" links navigate to the respective pages.

### Signup Page (`app/(auth)/signup/SignupForm.tsx`)

Same visual design as LoginForm. On submit:
1. Calls `supabase.auth.signUp({ email, password })`
2. Supabase sends a verification email automatically
3. On success: toast + redirect to `/overview` (or pending state if email verification required)

### Reset Password Page (`app/(auth)/reset-password/ResetPasswordForm.tsx`)

Single email field. On submit:
1. Calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: '/reset-password' })`
2. Shows a success message instructing user to check their email
3. Does not auto-redirect — stays on the page

### Auth Flow Summary

```
/login  →  POST signInWithPassword  →  success → /overview
/signup →  POST signUp               →  success → /overview (or pending)
/reset-password → POST resetPasswordForEmail → show confirmation
```

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Login form submits | Fill form → click Sign in → observe redirect to /overview |
| Wrong password shows error | Submit wrong credentials → red error alert appears |
| Password show/hide works | Toggle password visibility → input type changes |
| Signup creates user | Fill signup form → submission creates Supabase Auth user |
| Email verification (if enabled) | Sign up → check Supabase Auth dashboard for unverified user |
| Reset password email sent | Submit email → Supabase sends reset email |
| Authenticated user → `/login` | Already logged in → navigate to `/login` → redirect to /overview |
| `pnpm build` | Compiles without errors |
