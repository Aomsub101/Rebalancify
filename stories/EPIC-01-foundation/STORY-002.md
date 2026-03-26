# STORY-002 — Next.js Scaffold, Auth, and Middleware

**Epic:** EPIC-01 — Foundation
**Phase:** 0
**Estimate:** M (3–5 days)
**Status:** 🔲 Not started
**Depends on:** STORY-001 (auth trigger must exist for signup to create profile)
**Blocks:** STORY-003

---

## User Story

As a new user, I can sign up with email and password, verify my email, log in, and be redirected to the dashboard. As an unauthenticated visitor, I am redirected to the login page when trying to access any dashboard route.

---

## Acceptance Criteria

1. `pnpm dev` starts without errors. TypeScript strict mode enabled, zero type errors.
2. Sign up with a valid email creates a user in Supabase Auth and auto-creates a `user_profiles` row.
3. Sign up with a duplicate email returns a clear error message.
4. Login with correct credentials redirects to `/overview`.
5. Login with wrong credentials shows a clear error message (not a generic one).
6. Accessing `/overview` (or any `/` dashboard route) while unauthenticated redirects to `/login` via `middleware.ts`.
7. The Supabase browser client is configured at `lib/supabase/client.ts` and the server client at `lib/supabase/server.ts`.
8. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are loaded from `.env.local`.
9. Reset password page sends a recovery email via Supabase Auth.
10. Tailwind CSS is configured with CSS variable tokens from `docs/design/01-design-system.md`. `bg-card`, `text-foreground`, etc. resolve correctly.

---

## Tasks

- [ ] `npx create-next-app@15 rebalancify --typescript --tailwind --app` — pins Next.js 15 explicitly; do NOT use create-next-app@latest as that may advance to a future breaking major version
- [ ] Confirm React 19 is installed: `node -e "require('./node_modules/react/package.json').version" | grep "^19"` — the design system in frontend_style/ was built against React 19 and Next.js 15
- [ ] **Immediately after scaffolding, pin Tailwind to v3:** `npm install tailwindcss@3 --save-exact` — the project uses v3 syntax (`@tailwind base/components/utilities`). Do NOT use the latest Tailwind (v4+) which uses a different CSS import syntax and breaks all token definitions in `docs/design/05-theme-implementation.md`.
- [ ] Install core dependencies: `pnpm add @supabase/supabase-js @supabase/ssr @tanstack/react-query lucide-react`
- [ ] Install Sonner (toast notifications): `pnpm add sonner` — this is the ONLY toast library used in the project. Do not use shadcn/ui's own Toast component.
- [ ] Install Vitest and test utilities: `pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event`
- [ ] Install Playwright (E2E): `pnpm create playwright` — accept defaults; select TypeScript; do NOT install browsers in CI (they are installed separately in ci.yml)
- [ ] Install shadcn/ui: `npx shadcn-ui@latest init`
- [ ] Add these scripts to `package.json` (add under the existing `"scripts"` key — do not remove existing scripts):
  ```json
  "type-check": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:e2e": "playwright test"
  ```
- [ ] Add Vitest configuration. Create `vitest.config.ts` at the project root:
  ```typescript
  import { defineConfig } from 'vitest/config'
  import react from '@vitejs/plugin-react'
  import path from 'path'

  export default defineConfig({
    plugins: [react()],
    test: {
      environment: 'jsdom',
      setupFiles: ['./test-utils/setup.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: ['lib/**', 'app/api/**'],
        exclude: ['node_modules', '.next'],
      },
    },
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },
  })
  ```
- [ ] Create `test-utils/setup.ts`:
  ```typescript
  import '@testing-library/jest-dom'
  ```
- [ ] Create `test-utils/mock-request.ts` (used in route handler tests):
  ```typescript
  export function createMockRequest(body: Record<string, unknown>): Request {
    return new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }
  ```
- [ ] Configure `tailwind.config.ts` with CSS variable tokens from design system
- [ ] Add CSS variable definitions to `app/globals.css` (light + dark mode)
- [ ] Write `lib/supabase/client.ts` (browser client)
- [ ] Write `lib/supabase/server.ts` (server-side client for API routes)
- [ ] Write `middleware.ts` (JWT validation, redirect unauthenticated → /login)
- [ ] Write `app/(auth)/login/page.tsx` (email + password, error states)
- [ ] Write `app/(auth)/signup/page.tsx` (email + password, error states)
- [ ] Write `app/(auth)/reset-password/page.tsx`
- [ ] Write `contexts/SessionContext.tsx` (session, profile, siloCount)
- [ ] Write `app/layout.tsx` (SessionContext provider, QueryClient provider, Inter + JetBrains Mono fonts). MUST include `<Toaster>` from Sonner at the root so toasts work globally:
  ```tsx
  import { Toaster } from 'sonner'
  // Inside the body:
  <Toaster position="bottom-right" richColors closeButton />
  ```
- [ ] Install and configure Resend SDK: `pnpm add resend`. Add `RESEND_API_KEY` to `.env.local` and `.env.example`. Verify Resend is in the installed dependency list. (Resend is used in STORY-020 — establishing it in the scaffold prevents a phantom dependency.)
- [ ] Create `styles/globals.css` as an exact mirror of `app/globals.css` (required by `docs/design/05-theme-implementation.md`). Both files must be identical at all times — if one is edited, the other must be updated in the same commit.
- [ ] Verify all acceptance criteria

---

## Definition of Done

- [ ] All 10 acceptance criteria verified
- [ ] Zero Tailwind CSS variable resolution errors
- [ ] Auth flow tested end-to-end: signup → verify → login → redirect to /overview
- [ ] Unauthenticated redirect tested: visiting /overview without a session redirects to /login
- [ ] Tailwind tokens verified: `bg-card`, `text-foreground`, `bg-primary` resolve correctly in browser
- [ ] UI renders correctly in both light and dark mode (toggle and verify)
- [ ] UI renders correctly at 375px (mobile) and 1280px (desktop) viewport widths
- [ ] All interactive elements have visible focus ring (`focus-visible:ring-2 focus-visible:ring-ring`)
- [ ] No API keys or user PII appear in console logs
- [ ] `pnpm test` runs with exit 0 (no failures — even with zero test files yet, the runner itself must work)
- [ ] `pnpm type-check` runs with exit 0
- [ ] `pnpm build` passes
- [ ] `<Toaster>` is mounted in the app — verify by calling `toast('Test')` from the browser console on localhost:3000 and confirming a toast appears bottom-right
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] `bd close <task-id> "STORY-002 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] Every page implemented in this story exports a `metadata` object or `generateMetadata` function following the format `[Page Name] | Rebalancify`
