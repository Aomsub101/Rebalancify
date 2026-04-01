# Sub-Component: Research Header

## 1. The Goal

Display the research context for the current ticker — the ticker symbol, company name, and the last refresh timestamp — and provide the `RefreshButton` to trigger a fresh LLM call. The header anchors the page and confirms exactly which asset is being researched.

---

## 2. The Problem It Solves

A user may navigate to the Research page from multiple entry points. The header ensures they always know which ticker they are looking at and when the data was last generated.

---

## 3. The Proposed Solution / Underlying Concept

### Content

- **Ticker**: Large, bold monospace text (e.g., "AAPL")
- **Company Name**: Regular weight, secondary colour (e.g., "Apple Inc.")
- **Last Refreshed**: Relative timestamp (e.g., "Refreshed 2 hours ago") or absolute datetime if >24h old
- **RefreshButton**: Icon button (Lucide `RefreshCw`) with loading spinner state

### RefreshButton States

| State | Appearance |
|---|---|
| Idle | `RefreshCw` icon, no spinner |
| Loading (in-flight LLM call) | `RefreshCw` icon + spinning animation |
| Just refreshed | Brief checkmark animation then back to idle |

### Timestamp Format

Uses a relative time utility (e.g., "2 hours ago", "yesterday"). If the data is >24 hours old, shows absolute date instead.

### Layout

The header is a horizontal flex row: ticker + company name on the left, refresh button on the right. On mobile, stacks vertically.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Ticker + company name shown | Visual: header shows "AAPL" and "Apple Inc." |
| Relative timestamp shown | Manual: check "Refreshed 2 hours ago" format |
| Refresh spinner during fetch | Throttle network → refresh button spins |
| `pnpm build` | Header compiles without errors |
