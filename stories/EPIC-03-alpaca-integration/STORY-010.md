# STORY-010 — Rebalancing Calculator (Partial + Full Modes)

## AGENT CONTEXT

**What this file is:** A user story specification for the deterministic rebalancing engine — partial and full modes, cash injection, pre-flight validation, session creation. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F1-R5 (partial mode), F1-R6 (full mode), F1-R7 (pre-flight validation), F1-R8 (cash injection)
**Connected to:** `docs/architecture/02-database-schema.md` (rebalance_sessions, rebalance_orders tables), `docs/architecture/03-api-contract.md` (calculate endpoint), `docs/architecture/04-component-tree.md` (RebalanceConfigPanel)
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-03 — Alpaca Integration
**Phase:** 2
**Estimate:** 3 developer-days (maximum per-story limit reached — this story must be split before implementation begins; see splitting guidance added to Notes section below)
**Status:** 🔲 Not started
**Depends on:** STORY-008 (target weights), STORY-009 (price fetching established)
**Blocks:** STORY-011

---

## User Story

As a user, I can calculate a precise rebalancing plan for my silo in either Partial or Full mode, with optional cash injection, and review the orders before approving.

---

## Acceptance Criteria

1. `POST /api/silos/:id/rebalance/calculate` returns a session object with `session_id`, `balance_valid`, `orders[]`, `snapshot_before`, and all fields per the API contract.
2. **Partial mode:** Buy orders never exceed available cash after accounting for all sell proceeds. Residual drift ≤ 2%.
3. **Full mode:** Computed post-execution weights are within ±0.01% of target weights.
4. **Pre-flight failure:** Insufficient cash → HTTP 422, `balance_valid: false`, `balance_errors` array with specific shortfall details.
5. **Silo isolation:** Two silos with the same asset at different quantities — calculation for silo A is unaffected by silo B's data. Verified via unit test.
6. **Cash injection:** `include_cash: true, cash_amount: "500.00000000"` → that cash is added to available capital before calculation.
7. **Weights ≠ 100%:** Calculation proceeds normally; `weights_sum_pct` and `cash_target_pct` are included in the response.
8. **No orders needed:** All assets within rounding precision of target → response returns `orders: []` (empty array), `balance_valid: true`.
9. A `rebalance_sessions` row is created by this endpoint (status: `'pending'`). It has `snapshot_before` populated. It has no `updated_at` column.
10. Calculation completes in < 2 seconds for 50 holdings (timing assertion in unit test).

---

## Tasks

- [ ] Write `lib/rebalanceEngine.ts` (partial mode + full mode calculation)
- [ ] Write `app/api/silos/[silo_id]/rebalance/calculate/route.ts`
- [ ] Unit test: partial mode — no overspend
- [ ] Unit test: full mode — ±0.01% accuracy
- [ ] Unit test: silo isolation (two-silo scenario)
- [ ] Unit test: pre-flight failure (insufficient cash → 422)
- [ ] Unit test: cash injection
- [ ] Unit test: weights ≠ 100 (proceeds normally)
- [ ] Unit test: empty orders (all at target)
- [ ] Unit test: timing (< 2 seconds for 50 holdings)

---

## Definition of Done

- [ ] All 10 acceptance criteria verified
- [ ] All unit tests in the tasks list above passing
- [ ] `rebalance_sessions` row verified: no `updated_at` column
- [ ] Silo isolation test documented
- [ ] `bd close <task-id> "STORY-010 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file

---

- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file

---

## Notes

This story exceeds the 3-developer-day maximum and must be split into two stories before implementation:

- **STORY-010a:** `POST /rebalance/calculate` API route — engine logic, session creation, partial mode only
- **STORY-010b:** Full mode calculation, pre-flight validation, cash injection, all unit tests

Create `STORY-010b.md` as a sibling file in `EPIC-03-alpaca-integration/` before starting STORY-010a. Add both to `stories/epics.md` and `PROGRESS.md`.
