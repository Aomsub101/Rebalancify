# TS.4.2 — Silo Card Component

## Task
Build the SiloCard used in both Overview and Silos list pages.

## Target
`components/silos/SiloCard.tsx`

## Inputs
- TS.4.1 outputs (Overview page)
- `docs/architecture/04-component-tree.md` §2.2

## Process
1. Enhance `components/silos/SiloCard.tsx` (created in Sprint 1):
   - **SiloHeader:** name + PlatformBadge + ExecutionModeTag
   - **TotalValueDisplay:** base currency value; USD value if toggle on
   - **DriftStatusSummary:** "X assets breached / all within threshold"
   - **AlpacaLiveBadge:** conditional — only when `alpaca_mode = 'live'`
   - Click → navigates to `/silos/[silo_id]`
2. Create `components/shared/AlpacaLiveBadge.tsx`:
   - Persistent amber badge with "LIVE" text
   - Shown when Alpaca silo is in live mode (not paper)
   - Used by: SiloCard, SiloHeader, RebalancePage

## Outputs
- Updated `components/silos/SiloCard.tsx`
- `components/shared/AlpacaLiveBadge.tsx`

## Verify
- Card shows correct total value in both currencies
- Drift summary accurate
- AlpacaLiveBadge appears only for live Alpaca silos

## Handoff
→ TS.4.3 (Drift digest cron)
