# TS.4.3 — E2E Tests

## Task
Write Playwright E2E tests for the news page user interactions.

## Target
`tests/e2e/news.spec.ts`

## Process
1. `tests/e2e/news.spec.ts`:
   - **Tab switching:** Portfolio → Macro → back to Portfolio
   - **Refresh:** Click refresh → new articles appear
   - **Rate limit:** Rapid refresh → RateLimitBanner shown
   - **Read article:** Hover → click "Mark as read" → styling changes
   - **Dismiss article:** Hover → click "Dismiss" → card removed from list
   - **Pagination:** Navigate pages, verify article counts
   - **Empty state:** User with no holdings → "No articles matching" message
   - **External link:** Click headline → new tab opened
2. Mock Finnhub/FMP responses via Playwright route interception

## Outputs
- `tests/e2e/news.spec.ts`

## Verify
- `pnpm test:e2e -- news.spec.ts` passes all tests

## Handoff
→ Component 06 complete
