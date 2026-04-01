# Sub-Component: Research Hub Client

## 1. The Goal

Render the full `/research/[ticker]` page as a client component orchestrator. It fetches the cached research session, displays the `ResearchHeader`, conditionally gates on `LLMKeyGate`, and composes the three result cards (`SentimentCard`, `RiskFactorsCard`, `NarrativeSummaryCard`) in the correct order.

---

## 2. The Problem It Solves

The research page has multiple states: loading, error, no-key, cached result, fresh LLM result. The client orchestrator must manage data fetching (via TanStack Query `useQuery`), handle all states consistently, and compose the correct sub-components for each state.

---

## 3. The Proposed Solution / Underlying Concept

### Page Structure

```
/research/[ticker]/page.tsx
└── ResearchHubClient (client component)
    ├── DisclaimerBanner              (always visible, non-conditional)
    ├── LLMKeyGate                    (if llm_connected === false)
    └── (else)
        ├── ResearchHeader            (ticker, company name, refresh, timestamp)
        ├── RefreshButton             (inline in header; spinner during fetch)
        └── ResearchCards
            ├── SentimentCard
            ├── RiskFactorsCard
            └── NarrativeSummaryCard
```

### Data Fetching

`useQuery({ queryKey: ['research', ticker], queryFn: () => GET /api/research/:ticker })`

On success → renders research cards.
On error → `ErrorBanner` with retry button.
On loading → `LoadingSkeleton` (matching layout of cards).

### Refresh Behaviour

`RefreshButton` calls `POST /api/research/:ticker` with `{ refresh: true }`. While in-flight, the button shows a spinner and cards remain interactive (but show stale data). On success, query is invalidated and cards re-render with fresh data.

### Trigger Sources

Users reach the Research page via:
1. Direct navigation to `/research/[ticker]`
2. Clicking a holding's ticker in the silo detail page (`HoldingRow` ticker is a link)
3. Clicking a ticker in the Discover page's peer grid

### Page Metadata

`/research/[ticker]/page.tsx` exports `generateMetadata({ params })` returning `{ title: '{$ticker} Research | Rebalancify' }`.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Research page renders all 3 cards | Manual: navigate to `/research/AAPL` → 3 cards visible |
| Loading skeleton shown during fetch | Throttle network → skeleton visible |
| Error banner on API error | Mock API 500 → ErrorBanner with retry button |
| Refresh button bypasses cache | Click refresh → DevTools shows `POST` with `{ refresh: true }` |
| `pnpm build` | Page compiles without errors |
