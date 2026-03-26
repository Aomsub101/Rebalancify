# STORY-010b — Rebalancing Calculator (Full Mode, Pre-flight, Cash Injection)

## AGENT CONTEXT

**What this file is:** A user story specification for the full-mode rebalancing calculation, pre-flight balance validation, cash injection, and all unit tests for the rebalancing engine. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F1-R6 (full mode), F1-R7 (pre-flight validation), F1-R8 (cash injection)
**Connected to:** `docs/architecture/02-database-schema.md` (rebalance_sessions, rebalance_orders), `docs/architecture/03-api-contract.md` (calculate endpoint), `lib/rebalanceEngine.ts` (created in STORY-010)
**Critical rules for agents using this file:**
- Do not start implementation until STORY-010 is marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-03 — Alpaca Integration
**Phase:** 2
**Estimate:** 2 developer-days
**Status:** 🔲 Not started
**Depends on:** STORY-010 (partial mode engine and calculate route)
**Blocks:** STORY-011

---

## User Story

As a user, the rebalancing calculator correctly handles full mode (exact weight targets), pre-flight balance validation, and cash injection — and all edge cases are covered by unit tests.

---

## Acceptance Criteria

1. **Full mode:** Computed post-execution weights are within ±0.01% of target weights.
2. **Pre-flight failure:** Insufficient cash → HTTP 422, `balance_valid: false`, `balance_errors` array with specific shortfall details.
3. **Silo isolation:** Two silos with the same asset at different quantities — calculation for silo A is unaffected by silo B's data. Verified via unit test.
4. **Cash injection:** `include_cash: true, cash_amount: "500.00000000"` → that cash is added to available capital before calculation.
5. **Weights ≠ 100%:** Calculation proceeds normally; `weights_sum_pct` and `cash_target_pct` are included in the response.
6. **No orders needed:** All assets within rounding precision of target → response returns `orders: []` (empty array), `balance_valid: true`.
7. Calculation completes in < 2 seconds for 50 holdings (timing assertion in unit test).

---

## Tasks

- [ ] Extend `lib/rebalanceEngine.ts`: add full mode calculation (±0.01% precision)
- [ ] Extend calculate route: pre-flight validation (insufficient cash → 422)
- [ ] Extend calculate route: cash injection support
- [ ] Unit test: full mode — ±0.01% accuracy
- [ ] Unit test: silo isolation (two-silo scenario)
- [ ] Unit test: pre-flight failure (insufficient cash → 422)
- [ ] Unit test: cash injection
- [ ] Unit test: weights ≠ 100 (proceeds normally)
- [ ] Unit test: empty orders (all at target)
- [ ] Unit test: timing (< 2 seconds for 50 holdings)

---

## Definition of Done

- [ ] All 7 acceptance criteria verified
- [ ] All unit tests passing
- [ ] Silo isolation test documented
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] `bd close <task-id> "STORY-010b complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
