# STORY-008 — Target Weights

## AGENT CONTEXT

**What this file is:** A user story specification for the target weights editor — atomic PUT of per-asset weight percentages, inline editing, WeightsSumBar, and cash target calculation. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F1-R3 (target weights storage), F1-R4 (weights validation and cash target)
**Connected to:** `docs/architecture/02-database-schema.md` (target_weights table), `docs/architecture/03-api-contract.md` (target-weights endpoint), `docs/architecture/04-component-tree.md` (TargetWeightCell, WeightsSumBar, WeightsSumWarning)
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-02 — Silos & Holdings
**Phase:** 1
**Estimate:** 1 developer-day
**Status:** 🔲 Not started
**Depends on:** STORY-007
**Blocks:** STORY-010 (rebalancing calculator requires weights)

---

## User Story

As a user, I can set target weight percentages for each holding in a silo. The weights do not need to sum to 100% — the remainder is treated as a cash target.

---

## Acceptance Criteria

1. `PUT /api/silos/:id/target-weights` atomically replaces all weight rows for the silo. Returns `{ weights_sum_pct, cash_target_pct, sum_warning, weights[] }`.
2. A `weight_pct` value outside 0–100 returns HTTP 422 with a descriptive validation error.
3. Weights summing to ≠ 100 is accepted. `sum_warning: true` is set in the response.
4. Weights summing to exactly 100: `sum_warning: false`.
5. `TargetWeightCell` in `HoldingRow` is editable inline (for all silo types). Editing one weight updates the `WeightsSumBar` in real time (optimistic update).
6. `WeightsSumWarning` text reads: `"Your targets sum to X%. The remaining Y% will be held as cash after rebalancing."` (substituting actual values).
7. `CashBalanceRow` shows the computed `cash_target_pct` as a read-only label.
8. RLS: user B cannot PUT user A's target weights.
9. Unsaved changes guard: if the user has edited any weight value but has not clicked Save, and then attempts to navigate away (click a NavItem, browser back button, or close the tab), a browser `beforeunload` confirmation is shown AND the active NavItem highlights in amber to signal dirty state. On mobile, the dirty state indicator is a small amber dot on the Silos nav tab.

---

## Tasks

- [ ] Write `app/api/silos/[silo_id]/target-weights/route.ts` (GET, PUT)
- [ ] Add `TargetWeightCell` to `HoldingRow` (inline editable)
- [ ] Wire `WeightsSumBar` to live weight sum
- [ ] Write `WeightsSumWarning` component
- [ ] Unit test: PUT with weight > 100 → 422
- [ ] Unit test: sum ≠ 100 → sum_warning: true, correct cash_target_pct
- [ ] Write `hooks/useDirtyGuard.ts`: accepts `isDirty: boolean`, adds/removes `beforeunload` listener, returns a `confirmNavigation` function for programmatic navigation attempts
- [ ] Apply `useDirtyGuard` to the target weight editor: `isDirty = true` after first weight value change, `isDirty = false` after successful save
- [ ] RLS test: cross-user access

---

## Definition of Done

- [ ] All 9 acceptance criteria verified
- [ ] Unit tests for validation and sum_warning logic
- [ ] WeightsSumWarning displays correct substituted values
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] `bd close <task-id> "STORY-008 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] Every page implemented in this story exports a `metadata` object or `generateMetadata` function following the format `[Page Name] | Rebalancify`
