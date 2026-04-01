# Sub-Component: Error Banner

## 1. The Goal

Display a consistent, actionable error state when any data-fetching `useQuery` call fails. The banner shows the error code and message, provides a retry button, and is styled consistently with the Rebalancify design system.

---

## 2. The Problem It Solves

Network failures, API errors, and rate limits will happen. Without a standardised error component, failed queries either crash silently (blank page), show raw error text, or display inconsistent error UI. The `ErrorBanner` ensures every error is: (a) human-readable, (b) actionable (retry), and (c) consistent.

---

## 3. The Proposed Solution / Underlying Concept

### Banner Content

Each `ErrorBanner` displays:
- **Error code**: monospace, e.g., `ERR_NETWORK`, `500`, `429`
- **Error message**: human-readable description, e.g., "Failed to load silos — please try again"
- **Retry button**: a `Button` with `variant="outline"` and a `RefreshCw` icon

### Retry Behaviour

The retry button calls `queryClient.invalidateQueries({ queryKey })` for the failed query — re-running the fetch and returning to the loading state.

### Error States Not Covered

`ErrorBanner` is for `useQuery` (GET) errors. Form submission errors (POST/PATCH/DELETE) are shown as `Sonner` toast notifications instead.

### Design

- Background: `bg-destructive/10` (light red)
- Border: `border border-destructive/20`
- Icon: Lucide `AlertCircle` in `text-destructive`
- Retry button: `variant="outline"` + `RefreshCw` icon

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Every useQuery has isError branch | `grep -rn "useQuery" components/` → each file has `ErrorBanner` |
| Error banner shown on API failure | Mock API 500 → verify ErrorBanner appears |
| Error code + message displayed | Visual: error code and message visible |
| Retry button re-runs query | Click Retry → network tab shows re-fetch |
| `pnpm build` | Component compiles without errors |
