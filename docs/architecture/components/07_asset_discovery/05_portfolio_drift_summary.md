# Sub-Component: Portfolio Drift Summary

## 1. The Goal

Give users immediate context about how their existing portfolio is performing — at a glance — while they are exploring new assets on the Discover page. One `DriftSiloBlock` is rendered per active silo, showing each asset's current drift from target weight.

---

## 2. The Problem It Solves

A user on the Discover page may be evaluating whether to add a new asset. Before doing so, they should understand their current portfolio's drift — are some holdings significantly off-target? Showing this inline on the Discover page prevents the user from needing to switch to the Overview page to check portfolio health before researching a new addition.

---

## 3. The Proposed Solution / Underlying Concept

### Data Source

`GET /api/silos/:id/drift` is called for each active silo. The response includes per-asset drift data (current weight vs. target weight, expressed as a percentage and absolute value).

### Section Layout

The `PortfolioDriftSummary` renders as either:
- A sidebar panel on desktop (right of the main discover content)
- A collapsible section below the main discover content on mobile

### Per-Silo Rendering

Each silo renders a `DriftSiloBlock` (see `06_drift_silo_block.md`) containing:
- Silo name and platform badge
- One `DriftBadge` per holding showing drift direction and magnitude
- Overall silo drift indicator (sum of absolute drifts)

### Loading State

While `GET /api/silos/:id/drift` is in-flight, `LoadingSkeleton` is shown for each `DriftSiloBlock`.

### No Holdings State

If a silo has zero holdings, the `DriftSiloBlock` shows a message "No holdings yet" rather than a blank or error state.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Correct silo count rendered | User has 2 active silos → 2 `DriftSiloBlock` instances rendered |
| Drift data loaded per silo | Network tab: verify `GET /api/silos/:id/drift` called per silo |
| LoadingSkeleton shown during load | Throttle network → skeleton visible |
| DriftBadge shows direction + icon | Visual: green/red badge with drift direction icon |
| "No holdings" shown for empty silos | Create empty silo → verify message not error |
| Silo drift badge uses `text-right font-mono tabular-nums` | DevTools inspection |
