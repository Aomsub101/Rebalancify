# Sub-Component: Shared Utility Components

## 1. The Goal

Provide a small set of reusable UI primitives used across many pages — LoadingSkeleton for async loading states, ErrorBanner for inline error display, and EmptyState for zero-data states — that keep UI patterns consistent throughout the application.

---

## 2. The Problem It Solves

Every list or data-fetching page needs to handle three states: loading (skeleton), error (inline message), and empty (zero results). Without shared components, each page would implement these differently, creating visual inconsistency. The shared components standardize these three states.

---

## 3. The Proposed Solution / Underlying Concept

### LoadingSkeleton

**File:** `components/shared/LoadingSkeleton.tsx`

Renders `n` rows (default: 3) of `Skeleton` components from `shadcn/ui`. Uses `aria-busy="true"` and `aria-label="Loading"` for accessibility.

```typescript
export function LoadingSkeleton({ rows = 3 }: Props) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-md" />
      ))}
    </div>
  )
}
```

### ErrorBanner

**File:** `components/shared/ErrorBanner.tsx`

Displays an inline error message with a dismiss button. Uses `role="alert"` for screen reader announcement. Not yet fully reviewed in source — verify final implementation before use.

### EmptyState

**File:** `components/shared/EmptyState.tsx`

Shown when a query returns zero results. Typically renders a centred icon + message + optional CTA button. Not yet fully reviewed in source — verify final implementation before use.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| LoadingSkeleton renders correct rows | Pass `rows={1}` → 1 skeleton row rendered |
| LoadingSkeleton has correct aria | `aria-busy="true"` and `aria-label="Loading"` present |
| `pnpm test` | Shared component tests (if present) pass |
| Build | `pnpm build` — shared components compile without errors |
