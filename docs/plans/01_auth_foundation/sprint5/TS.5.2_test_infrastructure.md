# TS.5.2 — Test Infrastructure

## Task
Configure Vitest for unit/integration tests and Playwright for E2E tests.

## Target
`vitest.config.ts`, `playwright.config.ts`, test directories

## Inputs
- TS.2.1 outputs (Next.js project with dependencies)

## Process
1. Configure `vitest.config.ts`:
   - Test environment: `jsdom` for component tests, `node` for lib tests
   - Coverage: `v8` provider
   - Path aliases matching `tsconfig.json`
   - Scripts: `pnpm test`, `pnpm test:coverage`
2. Configure `playwright.config.ts`:
   - Base URL: `http://localhost:3000`
   - Browsers: Chromium (primary), Firefox (optional)
   - Web server: `pnpm dev` auto-started
   - Screenshots on failure
   - Script: `pnpm test:e2e`
3. Create test directory structure:
   ```
   tests/
   ├── unit/        (Vitest)
   ├── integration/ (Vitest)
   └── e2e/         (Playwright)
   ```
4. Create `test-utils/` with common test helpers:
   - Mock Supabase client
   - Test user factory
   - Render wrapper with providers

## Outputs
- `vitest.config.ts`
- `playwright.config.ts`
- `tests/` directory structure
- `test-utils/` helpers

## Verify
- `pnpm test` runs with exit 0 (even with zero tests)
- `pnpm test:e2e` launches browser and connects to dev server
- Coverage report generates

## Handoff
→ TS.5.3 (auth E2E tests)
