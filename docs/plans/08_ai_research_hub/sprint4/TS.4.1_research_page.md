# TS.4.1 — Research Page

## Task
Build the /research/[ticker] page layout with LLMKeyGate, header, and research cards.

## Target
`app/(dashboard)/research/[ticker]/page.tsx`

## Inputs
- Sprint 3 outputs (research endpoint)
- `docs/architecture/04-component-tree.md` §2.10
- `docs/architecture/components/08_ai_research_hub/11_research_hub_client.md`

## Process
1. Create `app/(dashboard)/research/[ticker]/page.tsx`:
   - **LLMKeyGate** wrapper — blocks UI if no LLM key
   - **DisclaimerBanner** — always visible, non-collapsible (TS.4.3)
   - **ResearchHeader:** ticker, company name, last refreshed timestamp
   - **RefreshButton:** triggers forced refresh (POST with `{ refresh: true }`)
     - Shows spinner during in-flight LLM call
   - **ResearchCards:** SentimentCard, RiskFactorsCard, NarrativeSummaryCard (TS.4.2)
   - LoadingSkeleton during initial fetch
   - ErrorBanner on LLM failures
2. On mount: call GET /api/research/:ticker (cached) or POST if no cache exists
3. TanStack Query key: `['research', ticker]`

## Outputs
- `app/(dashboard)/research/[ticker]/page.tsx`
- `components/research/ResearchHeader.tsx`

## Verify
- Page loads with cached data (no LLM call) when cache < 24h
- Refresh button triggers new LLM call
- LLMKeyGate blocks access without key
- LoadingSkeleton during LLM call

## Handoff
→ TS.4.2 (Research cards)
