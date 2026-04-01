# Sub-Component: Simulation Constraints Hook & Types

## 1. The Goal

Provide a pure-compute React hook (`useSimulationConstraints`) that synchronously derives whether the "Simulate Scenarios" button should be enabled, based purely on the current holdings array — specifically the holding count and each holding's `market_debut_date` field. Also provide the shared TypeScript interfaces (`SimulationResult`, `SimulationStrategy`, etc.) consumed by all simulation UI components and the Next.js API route.

---

## 2. The Problem It Solves

Before making any API call, the UI must enforce two hard preconditions without waiting for network requests: (1) at least 2 assets are present, and (2) every asset has at least 3 months of trading history. Deriving this from raw `holdings` array in every render would be error-prone and repetitive. A dedicated hook encapsulates the logic and produces a consistent `SimulationConstraints` object consumed by `SimulateScenariosButton`.

---

## 3. The Proposed Solution / Underlying Concept

### `useSimulationConstraints` (`hooks/useSimulationConstraints.ts`)

```typescript
export interface SimulationConstraints {
  assetCount: number
  minAgeMet: boolean
  isDisabled: boolean
  disableReason: string | null
}

export function useSimulationConstraints(holdings: Holding[]): SimulationConstraints
```

**Constraint 1 — Minimum Assets:**
If `holdings.length < 2` → `isDisabled: true`, `disableReason: "Simulation requires at least 2 assets."`

**Constraint 2 — Minimum Age:**
Compute `threeMonthsAgo = Date.now() - (90 × 24 × 60 × 60 × 1000)`. If any holding has `market_debut_date = null` OR `market_debut_date > threeMonthsAgo` → `isDisabled: true`, `disableReason: "Simulation requires all assets to have at least 3 months of market price history."`

Note: uses 90 days as a conservative proxy for 3 calendar months. The yfinance backfill returns the actual earliest available trading date.

**Key facts:**
- Pure `useMemo` — no API calls, no state mutations
- Returns `minAgeMet: boolean` so callers can distinguish the two failure modes
- `market_debut_date = null` is treated as "not confirmed" — disabled with the age reason (not a separate null reason)

### Shared TypeScript Interfaces (`lib/types/simulation.ts`)

```typescript
export interface SimulationStrategy {
  weights: Record<string, number> // e.g. { AAPL: 0.4, TSLA: 0.6 }
  return_3m: string               // e.g. "2.34%"
  range: string                   // e.g. "2.34% ± 1.20%"
}

export interface SimulationStrategies {
  not_to_lose: SimulationStrategy
  expected: SimulationStrategy
  optimistic: SimulationStrategy
}

export interface SimulationMetadata {
  is_truncated_below_3_years: boolean
  limiting_ticker: string
  lookback_months: number
}

export interface SimulationResult {
  strategies: SimulationStrategies
  metadata: SimulationMetadata
}
```

These interfaces are the single source of truth for the simulation data shape across the proxy route, the frontend state, and all UI components.

### F11-R13 State Deduplication (in parent component)

The `SiloDetailView` (or equivalent parent) holds a `useRef<string>` initialized to `""`. On each render, it computes `currentTickers = [...holdings].sort().join(",")`. On button click, if `currentTickers === ref.current`, it fires a toast ("Asset composition hasn't changed since last simulation.") and skips the API call. Otherwise it proceeds, then sets `ref.current = currentTickers`.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| 0 holdings → disabled, "at least 2 assets" reason | `useSimulationConstraints([])` → `isDisabled: true`, reason contains "at least 2" |
| 1 holding → disabled, "at least 2 assets" reason | `useSimulationConstraints([holding1])` → `isDisabled: true`, reason contains "at least 2" |
| 2 holdings, both ≥ 3 months old → enabled | Both with `market_debut_date = 2024-01-01` → `isDisabled: false` |
| Any holding with `null` debut → disabled, age reason | One holding with `market_debut_date = null` → `isDisabled: true`, reason contains "3 months" |
| Any holding < 3 months old → disabled, age reason | `market_debut_date = today - 60 days` → `isDisabled: true`, reason contains "3 months" |
| `assetCount` returned correctly | 3 holdings → `assetCount: 3` |
| `minAgeMet` is `true` only when all ≥ 3 months | All old → `minAgeMet: true`; one recent → `minAgeMet: false` |
| Re-computed on holdings change | Change holdings array → hook returns new `isDisabled` value |
| `SimulationResult` interface matches API response | Parse `POST /api/optimize` response → assign to `SimulationResult` variable → no TypeScript errors |
| `pnpm test` passes | `pnpm test hooks/useSimulationConstraints.test.ts` → all green |
