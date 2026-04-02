# TS.2.1 — Next.js Scaffold

## Task
Initialize Next.js 15 with App Router, Tailwind CSS v3, TanStack Query, TypeScript strict mode.

## Target
Project root

## Inputs
- `docs/architecture/01-tech-stack-decisions.md` (ADR-002)
- `docs/architecture/04-component-tree.md` (routing structure)

## Process
1. Initialize Next.js 15 with App Router: `npx create-next-app@latest --typescript --tailwind --app`
2. Pin Tailwind CSS to v3.x.x (not v4)
3. Install dependencies:
   - `@tanstack/react-query` — server state management
   - `@supabase/supabase-js`, `@supabase/ssr` — Supabase client
   - `sonner` — toast notifications
   - `lucide-react` — icons
   - `next-pwa` — PWA support (configured later in Component 09)
4. Configure `tsconfig.json` with strict mode
5. Set up `app/globals.css` with CSS variable tokens for design system:
   - `--sidebar-background`, `--card`, `--foreground`, `--primary`, etc.
6. Create routing skeleton:
   ```
   app/
   ├── layout.tsx (root — mounts Sonner Toaster)
   ├── (auth)/ (login, signup, reset-password)
   └── (dashboard)/ (layout.tsx = AppShell)
   ```
7. Configure TanStack Query provider in root layout

## Outputs
- `package.json` with all dependencies
- `tsconfig.json` with strict mode
- `tailwind.config.ts` with design tokens
- `app/globals.css` with CSS variables
- `app/layout.tsx` with Toaster + QueryClientProvider
- Routing skeleton directories

## Verify
- `pnpm build` succeeds with zero errors
- `pnpm dev` serves on localhost:3000
- Tailwind utility classes render correctly

## Handoff
→ TS.2.2 (Supabase client layer)
