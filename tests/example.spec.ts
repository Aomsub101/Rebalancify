import { test, expect } from '@playwright/test';

// Placeholder smoke test — replace with real E2E tests starting from STORY-004.
// See docs/development/03-testing-strategy.md for the E2E testing strategy.

test('dev server is reachable', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBeLessThan(500);
});
