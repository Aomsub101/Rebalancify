# Sub-Component: Overview Page

## 1. The Goal

Provide a high-level portfolio dashboard that aggregates all silos into a single view — showing total portfolio value, active silo count, unique asset count, and a global drift status across all assets — so users can assess their overall portfolio health in seconds.

---

## 2. The Problem It Solves

Users with multiple silos (Alpaca + BITKUB + manual) need to understand their aggregate exposure without navigating to each silo individually. The Overview solves this by computing portfolio-level totals, detecting any drift breaches across all silos, and surfacing the most important signal (drift) prominently.

---

## 3. The Proposed Solution / Underlying Concept

### Data Fetching Pattern

```typescript
// Parallel data fetching on Overview page
const silosQuery    = useQuery({ queryKey: ['silos'],       fn: fetchSilos })
const fxRatesQuery  = useQuery({ queryKey: ['fx-rates'],   fn: fetchFxRates })
const driftQueries  = useQueries({
  queries: silos.map(silo => ({
    queryKey: ['drift', silo.id],
    fn: () => fetchDrift(silo.id),
    enabled: !!silos,
  }))
})
```

`useQueries` (plural) runs one drift query per silo in parallel. `fxRates` query is shared with `TopBar` via the same `queryKey: ['fx-rates']` — zero duplicate requests.

### PortfolioSummaryCard

Three stat tiles:

| Tile | Shows |
|---|---|
| Total Value | Sum of all silo values (USD-converted if toggle on) |
| Active Silos | `X / 5` with remaining slot count |
| Unique Assets | Count of distinct `asset_id`s across all drift responses |

### GlobalDriftBanner

Shown only when `breachedAssets.length >= 1`. Renders a warning banner listing each breached ticker and its drift percentage. Hidden when all assets are within threshold.

```typescript
// Derived: collect all breached assets from all completed drift queries
const allDriftAssets = driftQueries.flatMap(q => q.data?.assets ?? [])
const breachedAssets = allDriftAssets.filter(a => a.drift_breached)
```

### SiloCardGrid

```typescript
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
  {silos.map(silo => (
    <SiloCard
      key={silo.id}
      silo={silo}
      showUSD={showUSD}
      usdRate={fxRates[silo.base_currency]}
      driftData={driftBySiloId[silo.id]}
    />
  ))}
</div>
```

`usdRate` is passed per-silo because each silo may have a different `base_currency` requiring a different FX rate.

### AlpacaLiveBadge (CLAUDE.md Rule 15)

An amber `LIVE` badge rendered inside `SiloCard` when `silo.platform_type === 'alpaca' && silo.alpaca_mode === 'live'`. This badge is never hidden and cannot be toggled off.

### Loading & Empty States

- **Loading**: Three `LoadingSkeleton` tiles (one per summary stat) + one skeleton row
- **Empty** (`silos.length === 0`): `EmptyState` component with `PieChart` icon and "No silos yet" message + CTA to `/silos/new`

### USD Toggle Wiring

`showUSD` comes from `SessionContext`. The `TopBar` handles the toggle; the `OverviewPage` reads `showUSD` and passes it to `PortfolioSummaryCard` and each `SiloCard`. No local state for USD mode — it flows from context.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Total value sums correctly | Two silos with $1000 and $500 → total shows $1500 |
| GlobalDriftBanner hidden when no breaches | All assets green → no banner rendered |
| GlobalDriftBanner shown with breaches | Any red/yellow → banner with ticker list appears |
| SiloCard USD conversion | Toggle on → SiloCard shows USD values |
| Loading skeleton shown on initial load | Refresh page with empty cache → skeletons visible |
| Empty state with CTA | No silos → EmptyState + "Create your first silo" button |
| `pnpm build` | Compiles without errors |
