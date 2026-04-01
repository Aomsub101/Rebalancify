# Sub-Component: Empty State

## 1. The Goal

Render a helpful, actionable placeholder when a list or table has no data to display. The empty state guides the user toward the action that would populate the list, rather than showing a blank or confusingly empty region.

---

## 2. The Problem It Solves

An empty table or list without context is ambiguous — did the fetch fail? Is the data loading? Is there genuinely no data? A well-designed `EmptyState` communicates "there is no data yet" clearly and provides a CTA to fix that.

---

## 3. The Proposed Solution / Underlying Concept

### EmptyState Design

Each `EmptyState` renders:
- **Icon**: a Lucide icon appropriate to the context (e.g., `Wallet` for holdings, `TrendingUp` for top movers, `Search` for discover)
- **Description**: a one-line message specific to the context, e.g., "No holdings in this silo yet"
- **CTA button**: a `Button` pointing to the action that would populate the list, e.g., "Add your first holding"

### CTA Buttons by Context

| List | CTA Button |
|---|---|
| Silos list | "Create your first silo" → `/silos/new` |
| Holdings list | "Add holding" → `/silos/[id]/holdings` |
| News list | "Refresh news" |
| Top movers | None (market data may genuinely be unavailable) |

### When It Renders

`EmptyState` is rendered when:
1. `useQuery` has returned successfully (`isError === false`)
2. The returned `data` is an empty array `[]`
3. It is NOT the first load (`isLoading === false`)

It is NOT rendered during loading (use `LoadingSkeleton`) or error (use `ErrorBanner`).

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| EmptyState in all list components | Code review: every list/table has `data.length === 0` branch |
| Correct icon per context | Visual: `Wallet` for empty holdings, appropriate icon for each list |
| Correct CTA per context | Visual: "Add your first holding" on empty holdings list |
| CTA navigates correctly | Click CTA → navigates to correct page |
| EmptyState NOT shown during loading | Visual: skeleton shown, not empty state |
| EmptyState NOT shown on error | Visual: ErrorBanner shown, not empty state |
| `pnpm build` | Component compiles without errors |
