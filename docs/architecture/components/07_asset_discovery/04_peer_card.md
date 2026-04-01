# Sub-Component: Peer Card

## 1. The Goal

Display a single peer asset (ticker, name, current price) as a compact card within the Discover page's peer grid. The card is a navigation gateway — clicking it routes to the full AI Research Hub page for that ticker.

---

## 2. The Problem It Solves

A list of ticker symbols alone is not actionable. Users need the company name for context and the current price to evaluate magnitude. The card must also visually integrate with the `AiInsightTag` (when available from Component 8 cache) without triggering additional LLM calls.

---

## 3. The Proposed Solution / Underlying Concept

### Card Content

Each `PeerCard` displays:
- `ticker` — bold, large monospace (e.g., "AAPL")
- `name` — regular weight (e.g., "Apple Inc.")
- `current_price` — formatted with `formatNumber()`, monospace
- Directional badge (price change from `price_cache`) — optional, with icon

### Click Behaviour

The entire card is clickable. On click, `router.push('/research/[ticker]')` is called — navigating to the AI Research Hub for that peer.

### AiInsightTag (v1.0: absent)

In v1.0 (STORY-026), `PeerCard` does NOT render `AiInsightTag`. This is confirmed by the audit rule in Component 7: `grep -rn "AiInsightTag" components/` → zero results in v1.0.

In v2.0 (STORY-033, Component 8), when `llm_connected = true` and a `research_sessions` row exists for the peer ticker, a brief (≤12 word) AI insight tag is shown on the card — reading from cache, no new LLM call.

### Layout in Grid

`PeerCard` instances are rendered in a CSS grid (typically 2–3 columns on desktop, 1–2 on mobile). The grid uses `gap-4` spacing.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Card renders ticker + name + price | Visual inspection of any `PeerCard` in peer grid |
| Card navigates on click | Click `PeerCard` → verify navigation to `/research/[ticker]` |
| `formatNumber()` used for price | Source grep for `formatNumber` within PeerCard |
| `AiInsightTag` absent in v1.0 | `grep -rn "AiInsightTag" components/discover/` → zero results |
| Grid layout responsive | Resize viewport → grid columns adjust appropriately |
