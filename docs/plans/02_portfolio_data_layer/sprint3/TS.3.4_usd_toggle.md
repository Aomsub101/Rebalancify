# TS.3.4 — USD Toggle

## Task
Implement the USD conversion toggle in TopBar, persisted via user profile.

## Target
`components/layout/USDToggle.tsx`

## Inputs
- TS.3.3 outputs (FX rates API)
- Component 01 TS.4.1 outputs (SessionContext with showUsd state)

## Process
1. Create `components/layout/USDToggle.tsx`:
   - Toggle switch in TopBar contextual actions area
   - Reads `showUsd` from SessionContext
   - On toggle: call `setShowUsd(value)` which persists via `PATCH /api/profile`
   - When on: all silo values converted to USD using `rate_to_usd`
   - Conversion is display-only — no DB writes
2. Fetch FX rates via `useQuery(['fx-rates'])` — cached by TanStack Query
3. When FX data unavailable: disable toggle, show "FX data unavailable" tooltip
4. Apply conversion in all value displays: SiloCard, PortfolioSummaryCard, HoldingsTable

## Outputs
- `components/layout/USDToggle.tsx`
- Updated value display components to respect `showUsd`

## Verify
- Toggle persists across page navigation and browser sessions
- Values convert correctly (spot check with known FX rate)
- FX unavailable → toggle disabled with tooltip

## Handoff
→ Sprint 4 (Overview page)
