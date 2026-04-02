# TS.5.3 — E2E Tests

## Task
Write Playwright E2E tests for the research page, LLMKeyGate, and disclaimer.

## Target
`tests/e2e/research.spec.ts`

## Process
1. `tests/e2e/research.spec.ts`:
   - **LLMKeyGate:** No key → gate message shown, no research UI
   - **Research page:** Configure key → navigate to /research/AAPL → cards render
   - **SentimentCard:** Correct color badge visible
   - **RiskFactorsCard:** Bulleted list with 2-8 items
   - **NarrativeSummaryCard:** Text visible, expandable works
   - **DisclaimerBanner:** Always visible, no close button in DOM
   - **RefreshButton:** Click → spinner → new data loads
   - **AiInsightTag:** On Discover PeerCard when cached research exists
   - **Key never in browser:** No provider domain URLs in frontend network calls
   - **formatNumber:** No `.toFixed()` in rendered text
2. Mock LLM responses via Playwright route interception

## Outputs
- `tests/e2e/research.spec.ts`

## Verify
- `pnpm test:e2e -- research.spec.ts` passes all tests

## Handoff
→ Component 08 complete
