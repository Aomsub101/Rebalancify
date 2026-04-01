# Sub-Component: Asset Peer Search

## 1. The Goal

Allow users to search for any stock or crypto asset by name or ticker symbol and immediately see a grid of peer assets — related companies in the same sector — without leaving the Discover page. This connects directly into the AI Research Hub when a peer is selected.

---

## 2. The Problem It Solves

Users researching an asset (e.g., "Should I add NVDA to my portfolio?") need peer context: what other companies operate in the same space? They would otherwise need to manually search Finnhub, open a separate browser tab, and cross-reference sectors. The search flow short-circuits this to a single interaction.

---

## 3. The Proposed Solution / Underlying Concept

### Search Input

A debounced text input (typically 300ms debounce) fires `GET /api/assets/search?q={query}&type={stock|crypto}` on each keystroke. The `type` parameter is inferred from the currently selected tab in `TopMoversTabs` (US Stocks → `stock`, Crypto → `crypto`).

### Results Display

Search results are rendered as a dropdown or inline list below the input. Each result shows:
- `ticker` (bold)
- `name` (regular weight)
- A small platform icon (stock vs. crypto)

### Peer Grid on Selection

When a user clicks a search result, `GET /api/assets/:id/peers` is called and the result is rendered as a `PeerCard` grid (see `04_peer_card.md`).

### Navigation Trigger

Clicking a `PeerCard` ticker navigates to `/research/[ticker]` — connecting the discovery surface to the AI Research Hub.

### Loading State

During the debounce wait and the API fetch, an inline loading indicator is shown. The `LoadingSkeleton` is NOT used here — instead a subtle spinner or pulse animation keeps the search context intact.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Debounce prevents excessive API calls | Type "nvidia" → verify single request fired after 300ms |
| Correct type param for stocks | Search on "US Stocks" tab → `?type=stock` in request |
| Correct type param for crypto | Search on "Crypto" tab → `?type=crypto` in request |
| Peer grid appears on selection | Click search result → `PeerCard` grid renders |
| Clicking PeerCard navigates | Click ticker → router navigates to `/research/[ticker]` |
| Empty query shows no results | Clear search → dropdown hides |
