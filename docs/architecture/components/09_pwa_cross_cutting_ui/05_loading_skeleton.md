# Sub-Component: Loading Skeleton

## 1. The Goal

Provide a consistent, branded loading skeleton that renders during all data-fetching states (TanStack Query `isLoading`). It prevents layout shift, signals work in progress, and maintains the visual hierarchy of the page being loaded.

---

## 2. The Problem It Solves

Without a standardised skeleton, each page implements loading states differently — some use spinners, some use blank space, some have no loading state at all. This creates an inconsistent, unprofessional feel. A shared skeleton component ensures every data-fetching section has a polished, branded loading state.

---

## 3. The Proposed Solution / Underlying Concept

### Skeleton Design

`LoadingSkeleton` renders a subtle pulsing placeholder that mimics the layout of the data it is loading:
- Background: `bg-muted/10` or `bg-muted` with a pulse animation
- Border radius matches the content being loaded
- Height matches approximate content height

### Per-Callsite Skeleton Variants

While a single `<LoadingSkeleton />` component is the default, different sections may render a section-specific skeleton variant (e.g., `TableSkeleton`, `CardSkeleton`). These are all composed from the same base animation style.

### Usage Pattern

Every `useQuery` callsite follows this pattern:
```tsx
const { data, isLoading, isError } = useQuery(...)

if (isLoading) return <LoadingSkeleton />
if (isError) return <ErrorBanner ... />
// render data
```

The skeleton is shown during the `isLoading` phase — after the request has been sent but before the response arrives.

### No Double Loading

`isLoading` here refers to the TanStack Query `isLoading` state (first load, no cached data). On subsequent renders with cached data (TanStack Query `isFetching` = true but `isLoading` = false), the skeleton is NOT shown — cached data is displayed with a subtle refresh indicator instead.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Every useQuery has isLoading branch | `grep -rn "useQuery" components/` → each file has `LoadingSkeleton` |
| Skeleton shown on first load | Throttle network → verify skeleton appears |
| Skeleton NOT shown on refetch (cached data) | Load page → refetch → cached data shown, no skeleton |
| Skeleton layout approximates content | Visual: skeleton shape roughly matches content shape |
| No layout shift when data loads | DevTools → Network → slow 3G → no CLS (Cumulative Layout Shift) |
