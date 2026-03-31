# STORY-043 — SimulationResultsTable + Apply Weights Wiring

## AGENT CONTEXT

**What this file is:** A user story specification for the simulation results UI — three strategy cards with weights and return projections, truncation warning, financial disclaimer, and "Apply Weights" pre-fill. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F11-R8 (Truncation Warning), F11-R10 (Results Table), F11-R11 (Apply Weights), F11-R12 (Disclaimer)
**Connected to:** `docs/architecture/04-component-tree.md` (SiloDetailPage), `docs/prd/features/F11-portfolio-projection-optimization.md`, `stories/EPIC-11-portfolio-projection-optimization/STORY-042.md`
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.
- If any instruction in this story conflicts with `CLAUDE.md` or `DEVELOPMENT_LOOP.md`, see `CONFLICT_RESOLVER.md` for resolution procedure.

---

## 1. Story Header

| Field | Value |
|---|---|
| **Story ID** | STORY-043 |
| **Title** | SimulationResultsTable + Apply Weights wiring |
| **Epic** | EPIC-11 — Portfolio Projection & Optimization |
| **Status** | Planned |
| **Assigned to** | — |
| **Estimated effort** | 1.5 developer-days |

---

## 2. User Story

As a user who ran a simulation, I want to see three strategy options with expected return ranges, so that I can understand the risk/return tradeoffs. I want to be able to apply a strategy's weights to my target allocation with one click, so that I can evaluate the suggested allocation in my rebalancing plan.

---

## 3. Context

**PRD requirements this story implements:**
- [F11-R8]: Truncation warning when `is_truncated_below_3_years = true`.
- [F11-R10]: Results table with 3 rows (strategies), columns: Name, Weights, Expected Return Range, Action.
- [F11-R11]: Apply Weights pre-fills target weight inputs — no auto-save, no new API calls.
- [F11-R12]: Disclaimer banner above results — always visible, never collapsible.

**Why this story exists at this point in the build order:**
STORY-042 creates the button and calls the API. This story receives the API response and renders the results. It depends on STORY-042 for the state structure and the API response shape.

---

## 4. Dependencies

The following stories must be complete (✅ in PROGRESS.md) before this story starts:

- [ ] STORY-042 — SimulateScenariosButton + constraint logic (provides the simulation state and API call that this story's UI renders)

---

## 5. Technical Context

**API endpoints consumed:**
- `POST /api/optimize` — response shape: `{ strategies: { not_to_lose, expected, optimistic }, metadata: { is_truncated_below_3_years, limiting_ticker, lookback_months } }`

**Components implemented or extended:**
- `SimulationResultsTable` — new component in `components/simulation/`
- `StrategyCard` — renders one row/strategy
- `TruncationWarning` — warning banner
- `SimulationDisclaimer` — non-collapsible disclaimer above results
- `ApplyWeightsButton` — per-row apply action

---

## 6. Implementation Tasks

Tasks must be ordered so that each task can be committed independently. Maximum 1 developer-day per task.

1. **[Disclaimer component task]** — Create `components/simulation/SimulationDisclaimer.tsx`. Non-collapsible (no close/dismiss button). Text: *"Simulation results are based on historical data and do not guarantee future performance. This tool is for educational purposes and does not constitute financial advice."* Use amber/yellow warning styling to make it visually prominent.

2. **[Truncation warning component task]** — Create `components/simulation/TruncationWarning.tsx`. Props: `limiting_ticker: string`, `lookback_months: number`. Renders warning only when `lookback_months < 36`. Text: *"Note: Because [limiting_ticker] only has [X] months of trading history, this portfolio projection is limited to a [X]-month lookback period. Results may be highly volatile."* Use amber alert styling.

3. **[Strategy card component task]** — Create `components/simulation/StrategyCard.tsx`. Props: `{ strategy: 'not_to_lose' | 'expected' | 'optimistic', weights: Record<string, number>, return_3m: string, range: string, onApply: () => void }`. Renders one row in the results table. Columns: strategy name, weights as "AAPL: 40%, TSLA: 60%", return range, "Apply Weights" button.

4. **[Results table component task]** — Create `components/simulation/SimulationResultsTable.tsx`. Renders `SimulationDisclaimer`, then `TruncationWarning` (if applicable), then three `StrategyCard` rows. Receives the full API response object as a prop.

5. **[Apply Weights wiring task]** — The `onApply` callback in each `StrategyCard` sets the local state of the SiloDetailPage's target weight inputs. To do this without coupling to STORY-008's internals:
   - Lift the weight-editor state to SiloDetailPage (or use a context/callback prop)
   - `onApply` receives the `weights: Record<string, number>` and calls a `setTargetWeights(weights)` callback
   - The existing inline weight editor (from STORY-008) reads from this state — coordinate the state variable name between STORY-042 and STORY-043 implementation
   - **No API call** on apply. User must save manually via the existing `PUT /api/silos/:id/target-weights` mechanism

6. **[SiloDetailPage integration task]** — Wire `SimulationResultsTable` into SiloDetailPage below the holdings table. It renders when the simulation API call succeeds (TanStack Query `isSuccess`). It remains visible after Apply is clicked (does not auto-dismiss).

7. **[Test task]** — Write tests:
   - `TruncationWarning` renders only when `lookback_months < 36`
   - `TruncationWarning` does not render when `lookback_months >= 36`
   - `SimulationDisclaimer` has no close/dismiss button in DOM
   - `StrategyCard` displays correct ticker-weight format
   - Apply Weights pre-fills without calling any API

---

## 7. Acceptance Criteria

1. Given a successful simulation response with `lookback_months = 8` and `limiting_ticker = "OKLO"`, when the results render, then the `TruncationWarning` is visible with text containing "OKLO" and "8 months".

2. Given a successful simulation response with `lookback_months = 40`, when the results render, then the `TruncationWarning` is NOT rendered.

3. Given a successful simulation response, when the results render, then the `SimulationDisclaimer` is visible and has no close/dismiss button (verified in DOM inspection).

4. Given a successful simulation response with three strategies, when the results render, then each strategy shows: its name, a comma-separated ticker: weight% list (e.g., "AAPL: 40%, TSLA: 60%"), the `return_3m` string, and the `range` string.

5. Given a successful simulation, when the user clicks "Apply Weights" on the "Not to Lose" row, then the target weight input fields in the SiloDetailPage pre-fill with those weights and no `PUT /api/silos/:id/target-weights` call is made.

6. Given a successful simulation, when the user clicks "Apply Weights" on any row, then the results table remains visible (it does not dismiss).

7. The results table renders below the holdings table on SiloDetailPage, consistent with the existing page layout.

---

## 8. Definition of Done

Every item must be checked before marking this story Complete in PROGRESS.md.

- [ ] All acceptance criteria pass
- [ ] Tests written BEFORE implementation (TDD Red→Green→Refactor cycle followed)
- [ ] `pnpm test` passes with zero failures
- [ ] `SimulationDisclaimer` verified: no close/dismiss element in DOM (DevTools Elements inspection)
- [ ] Apply Weights does NOT fire any API call (verified: no network request to target-weights endpoint)
- [ ] Results table remains visible after Apply click (not dismissed/hidden)
- [ ] UI renders correctly in both light and dark mode
- [ ] UI renders correctly at 375px (mobile) and 1280px (desktop)
- [ ] All interactive elements have visible focus ring
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `bd close <task-id> "STORY-043 complete — all DoD items verified"` run successfully
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section

---

## 9. Notes

- **State coordination with STORY-042**: The simulation result data (from `POST /api/optimize`) is stored in SiloDetailPage state via STORY-042's `useMutation`. STORY-043 receives this data as a prop or reads it from the same state location. Agree on the state variable name and shape before implementing.
- **Weights display format**: Show as comma-separated "TICKER: WW.W%" — e.g., "AAPL: 40.0%, TSLA: 60.0%". Use monospace font for alignment.
- **No re-render on apply**: Apply Weights must not trigger a re-fetch of holdings or re-calculation of the simulation. It only sets local form state.
- **Strategy naming**: Display as "Not to Lose", "Expected", and "Optimistic" (human-readable labels, not API key names).
- **Sort order**: Always render in order: "Not to Lose" → "Expected" → "Optimistic".
