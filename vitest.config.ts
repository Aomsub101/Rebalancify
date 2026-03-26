import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Exclude Playwright E2E tests — those run via `pnpm test:e2e`, not vitest.
    exclude: ['tests/**', 'node_modules/**'],
    // Pass with zero test files — unit tests are added starting from STORY-002 lib/ files.
    passWithNoTests: true,
  },
})
