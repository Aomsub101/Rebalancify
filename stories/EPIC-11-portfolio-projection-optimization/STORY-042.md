# STORY-042 — SimulateScenariosButton & Constraint Logic

## AGENT CONTEXT

**What this file is:** A user story specification for the "Simulate Scenarios" button on SiloDetailPage, including the min-2-assets and min-3-months constraints and the frontend deduplication guard. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F11-R1 (Button Constraints), F11-R13 (Frontend State Deduplication)
**Connected to:** `docs/architecture/04-component-tree.md` (SiloDetailPage), `docs/prd/features/F11-portfolio-projection-optimization.md`
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.
- If any instruction in this story conflicts with `CLAUDE.md` or `DEVELOPMENT_LOOP.md`, see `CONFLICT_RESOLVER.md` for resolution procedure.

---

## 1. Story Header

| Field | Value |
|---|---|
| **Story ID** | STORY-042 |
| **Title** | SimulateScenariosButton + constraint logic |
| **Epic** | EPIC-11 — Portfolio Projection & Optimization |
| **Status** | Planned |
| **Assigned to** | — |
| **Estimated effort** | 1.5 developer-days |

---

## 2. User Story

As a user with a mature, multi-asset silo, I want to see an enabled "Simulate Scenarios" button so that I can launch the portfolio projection engine. As a user with an immature or single-asset silo, I want the button to be clearly disabled so that I understand why simulation is not yet available.

---

## 3. Context

**PRD requirements this story implements:**
- [F11-R1]: Button disabled if < 2 assets; disabled if any asset has < 3 months trading history.
- [F11-R13]: Deduplication guard — if asset composition hasn't changed, skip API call and show toast.

**Why this story exists at this point in the build order:**
STORY-041 builds the optimization API. This story adds the button UI, the constraint checks (which depend on holdings data the button sits beside), and the deduplication logic. STORY-043 adds the results display.

---

## 4. Dependencies

The following stories must be complete (✅ in PROGRESS.md) before this story starts:

- [ ] STORY-041 — Python optimization API (/api/optimize) (provides the endpoint to call)

---

## 5. Technical Context

**Database tables used:**
- `silos` — reads `id`, `user_id` for the current silo
- `holdings` — reads asset count for the silo's holdings
- `assets` — reads `created_at` for age check

**API endpoints called:**
- `POST /api/optimize` — called when button is clicked and constraints pass

**Components implemented or extended:**
- `SimulateScenariosButton` — new component in `components/simulation/` — placed on SiloDetailPage

---

## 6. Implementation Tasks

Tasks must be ordered so that each task can be committed independently. Maximum 1 developer-day per task.

1. **[Button component task]** — Create `components/simulation/SimulateScenariosButton.tsx`. Place it on the SiloDetailPage, below the holdings table (or above the RebalanceButton — coordinate with existing layout). Button is a primary-styled button with a chart/bar icon (e.g., `BarChart3` from Lucide).

2. **[Constraint logic task]** — Within SiloDetailPage (or via a `useSimulationConstraints` hook), compute:
   - `assetCount`: number of holdings in the silo (from `GET /silos/:id/holdings`)
   - `minAgeMet`: `true` if every holding's `asset.created_at` is at least 3 months before `NOW()`
   - `isDisabled`: `assetCount < 2 || !minAgeMet`

3. **[Tooltip task]** — When disabled, show a tooltip (use `title` attribute or shadcn Tooltip):
   - If `assetCount < 2`: `"Simulation requires at least 2 assets."`
   - If `!minAgeMet`: `"Simulation requires all assets to have at least 3 months of trading history."`

4. **[Deduplication task]** — Add a `useRef<string>` to SiloDetailPage: `lastSimulatedKey`. On button click:
   - Generate `currentKey = [...holdings].map(h => h.ticker).sort().join(',')`
   - If `currentKey === lastSimulatedKey.current`: fire toast `"Asset composition hasn't changed since last simulation."` and return early
   - If different: call `POST /api/optimize`, then set `lastSimulatedKey.current = currentKey`

5. **[Loading state task]** — While `POST /api/optimize` is in-flight, show a spinner on the button (or a small loading indicator next to the button text). The rest of the SiloDetailPage remains interactive.

6. **[Test task]** — Write tests:
   - Button disabled when silo has 1 holding
   - Button disabled when any holding's asset is < 3 months old
   - Button enabled when 2+ holdings all have ≥ 3 months history
   - Duplicate click (same tickers) fires toast and does NOT call API
   - New tickers: calls API and updates `lastSimulatedKey`

---

## 7. Acceptance Criteria

1. Given a silo with 0 or 1 holdings, when the SiloDetailPage renders, then the "Simulate Scenarios" button is disabled with the tooltip "Simulation requires at least 2 assets."

2. Given a silo with 2+ holdings but any holding's asset was added to the platform less than 3 months ago, when the page renders, then the button is disabled with the tooltip "Simulation requires all assets to have at least 3 months of trading history."

3. Given a silo with 2+ holdings all added 3+ months ago, when the page renders, then the button is enabled.

4. Given an enabled button, when the user clicks it, then the button shows a loading indicator and `POST /api/optimize` is called with the list of tickers from the silo's holdings.

5. Given the user clicks the button twice with the same asset composition, when the second click occurs, then `POST /api/optimize` is NOT called and a toast fires with "Asset composition hasn't changed since last simulation."

6. Given the user clicks the button with assets A, B and then adds asset C and clicks again, when the second click occurs, then `POST /api/optimize` IS called with A, B, C.

7. The button is placed on the SiloDetailPage below or adjacent to the holdings table, consistent with the existing page layout.

---

## 8. Definition of Done

Every item must be checked before marking this story Complete in PROGRESS.md.

- [ ] All acceptance criteria pass
- [ ] Tests written BEFORE implementation (TDD Red→Green→Refactor cycle followed for `useSimulationConstraints` and deduplication logic)
- [ ] `pnpm test` passes with zero failures
- [ ] Button renders correctly in both light and dark mode
- [ ] Button renders correctly at 375px (mobile) and 1280px (desktop)
- [ ] Disabled button shows correct tooltip text for each constraint
- [ ] Loading spinner visible during API call
- [ ] Toast fires on duplicate simulation attempt
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `bd close <task-id> "STORY-042 complete — all DoD items verified"` run successfully
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section

---

## 9. Notes

- **Asset age source**: Use `assets.created_at` as the proxy for trading history. This column is set when the asset is first mapped into any silo — it approximates when we first know about the asset. It is a conservative estimate; a real IPO date would be more accurate but is not available without additional API calls.
- **No new route**: This story does not create a new page route. The button and results live inline in the existing SiloDetailPage.
- **State lifting**: The simulation results state should be lifted to SiloDetailPage level so STORY-043 (which creates the results table) can access it. Coordinate the state variable name with STORY-043's implementation.
- **TanStack Query**: Use `useMutation` from TanStack Query for `POST /api/optimize`. Invalidate nothing on success — simulation is independent of other silo data.
