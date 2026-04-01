# Sub-Component: Simulation UI (Frontend Components)

## 1. The Goal

Render the portfolio simulation interaction on the SiloDetailPage: a "Simulate Scenarios" button (with constraint-based disabled state), a results table showing three strategy allocations with projected returns, a truncation warning when the lookback is insufficient, and an always-visible financial disclaimer. The user can click "Apply Weights" on any strategy to pre-fill the silo's target weight inputs.

---

## 2. The Problem It Solves

Without these components, the SiloDetailPage has no mechanism for users to run a quantitative simulation before committing to a rebalance. The UI must make the button's disabled state self-explanatory (tooltip on hover), render results clearly in a financial-data-appropriate layout (monospace, right-aligned numbers), and always surface the mandatory financial disclaimer so users are never misled into treating projections as guarantees.

---

## 3. The Proposed Solution / Underlying Concept

### SimulateScenariosButton (`components/simulation/SimulateScenariosButton.tsx`)

Placed below the holdings table on SiloDetailPage. Props: `holdings: Holding[]`, `onSimulate: () => void`, `isLoading: boolean`.

**Visual states:**

| State | Appearance |
|---|---|
| Enabled | Primary button, `<BarChart3>` icon |
| Disabled (< 2 assets) | Muted button, tooltip: "Simulation requires at least 2 assets." |
| Disabled (< 3 months history) | Muted button, tooltip: "Simulation requires all assets to have at least 3 months of market price history." |
| Loading (in-flight) | Muted button, `<Loader2>` spinner, label: "Simulating…" |

F11-R13 deduplication is handled by the parent component (not this button) using `useRef` with sorted ticker string.

### SimulationResultsTable (`components/simulation/SimulationResultsTable.tsx`)

Props: `result: SimulationResult`, `holdings: Holding[]`, `onApplyWeights: (weights: Record<string, number>) => void`.

Renders in fixed order: `SimulationDisclaimer` → conditional `TruncationWarning` → three `StrategyCard` components.

Layout: `space-y-3` vertical stack. No horizontal scroll — designed for desktop and tablet widths.

### SimulationDisclaimer (`components/simulation/SimulationDisclaimer.tsx`)

Non-collapsible amber banner (`role="note"`). Always rendered when `SimulationResultsTable` is mounted — never conditional on user action.

Text: *"Simulation results are based on historical data and do not guarantee future performance. This tool is for educational purposes and does not constitute financial advice."*

Separate from the page footer disclaimer (CLAUDE.md Rule 14) — this banner is specific to the simulation surface.

### TruncationWarning (`components/simulation/TruncationWarning.tsx`)

Props: `limiting_ticker: string`, `lookback_months: number`.

Shown only when `lookback_months < 36`. Renders an amber alert with `<AlertCircle>` icon and inline text: *"Note: Because [limiting_ticker] only has [X] months of trading history, this portfolio projection is limited to a [X]-month lookback period. Results may be highly volatile."*

Always returns `null` when `lookback_months >= 36` — no wrapper div rendered.

### StrategyCard (`components/simulation/StrategyCard.tsx`)

Props: `strategy: 'not_to_lose' | 'expected' | 'optimistic'`, `weights: Record<string, number>`, `return_3m: string`, `range: string`, `onApply: () => void`.

**Layout** (single horizontal row, 4 columns + action):

| Column | Width | Content |
|---|---|---|
| Strategy name | 7rem | Label: "Not to Lose" / "Expected" / "Optimistic" |
| Weights | 12rem | `"AAPL: 40.0%, TSLA: 60.0%"` — monospace, comma-separated |
| Expected Return | 6rem | `"2.34%"` — right-aligned, monospace, tabular-nums |
| Range | 9rem | `"2.34% ± 1.20%"` — right-aligned, monospace, muted |
| Action | auto | `<Button variant="outline" size="sm">Apply Weights</Button>` |

Weight display: `Object.entries(weights).map((ticker, w) => \`${ticker}: ${(w * 100).toFixed(1)}%\`)` — 1 decimal place for readability.

### Apply Weights Flow

Clicking "Apply Weights" calls `onApply(strategy.weights)` where `weights = { AAPL: 0.4, TSLA: 0.6 }`. The parent `SiloDetailView` converts ticker keys to `asset_id` keys (via its local holdings map) and sets local React state in the existing weight editor. No Supabase write occurs — user must manually save via the standard weight save flow.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Button disabled with 1 holding | `SimulateScenariosButton` with `[holding1]` → `disabled=true` |
| Button disabled when any holding has `market_debut_date = null` | Holding with `market_debut_date = null` → `disabled=true`, tooltip: "Simulation requires all assets to have at least 3 months..." |
| Button disabled when any holding added < 3 months ago | Holding with `market_debut_date = today - 60 days` → `disabled=true` |
| Button enabled with 2+ assets, all ≥ 3 months old | Two holdings with `market_debut_date = 2024-01-01` → `disabled=false` |
| Loading state shows spinner and "Simulating…" label | `SimulateScenariosButton` with `isLoading=true` → `<Loader2>` icon, label text |
| `SimulationResultsTable` renders 3 cards | Mount with valid `SimulationResult` → count `.StrategyCard` renders = 3 |
| `TruncationWarning` renders when lookback < 36 | `lookback_months=8` → amber alert visible |
| `TruncationWarning` hidden when lookback ≥ 36 | `lookback_months=60` → component returns null (nothing rendered) |
| `SimulationDisclaimer` always visible | Mount `SimulationResultsTable` → disclaimer div always present in DOM |
| Apply Weights emits ticker-keyed weights | Click "Apply Weights" on "optimistic" → `onApply` called with `{ AAPL: 0.7, TSLA: 0.3 }` |
| No API call on Apply Weights | Monitor network tab during Apply → no new requests fired |
| `formatNumber()` used for monetary values | `grep /\.toFixed\(/.` in `components/simulation/` → zero results |
| Weight string format "AAPL: 40.0%, TSLA: 60.0%" | Unit test: `{ AAPL: 0.4, TSLA: 0.6 }` → "AAPL: 40.0%, TSLA: 60.0%" |
| `pnpm test` passes | `pnpm test components/simulation/` → all green |
