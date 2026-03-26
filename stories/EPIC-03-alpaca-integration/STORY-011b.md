# STORY-011b — Rebalancing Wizard UI (3-Step)

## AGENT CONTEXT

**What this file is:** A user story specification for the full 3-step rebalancing wizard UI — RebalanceConfigPanel, OrderReviewPanel, ExecutionResultPanel, and ConfirmDialog. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F1-R9 (order review wizard UI), F1-R10 (ConfirmDialog non-dismissible rule)
**Connected to:** `docs/architecture/04-component-tree.md` (RebalanceConfigPanel, OrderReviewPanel, ExecutionResultPanel, ConfirmDialog), `docs/design/03-screen-flows.md` (Rebalancing Wizard layout), `CLAUDE.md` Rule 10 (non-dismissible ConfirmDialog)
**Critical rules for agents using this file:**
- Do not start implementation until STORY-011 is marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-03 — Alpaca Integration
**Phase:** 2
**Estimate:** 2 developer-days
**Status:** 🔲 Not started
**Depends on:** STORY-011 (execute API route)
**Blocks:** STORY-012

---

## User Story

As an Alpaca user, I can walk through the 3-step rebalancing wizard, review all calculated orders, confirm execution via a non-dismissible dialog, and see the result with per-order status.

---

## Acceptance Criteria

1. Rebalancing wizard has 3 steps with a `StepIndicator`: Config → Review → Result.
2. **Step 1 — Config:** Mode selector rendered as radio cards (not dropdown). `FullRebalanceWarning` shown when mode = full. Cash toggle + amount input. `WeightsSumWarning` shown when weights ≠ 100%.
3. **Step 2 — Review:** `OrdersTable` with all orders. Each `OrderRow` shows: ticker, order type badge (BUY green / SELL red), quantity, estimated value, weight arrow (before → after), skip checkbox.
4. **Step 2 — Non-Alpaca banner:** `ExecutionModeNotice` shown for non-Alpaca silos. Non-dismissible.
5. **Step 2 — Balance error:** If `balance_valid: false`, `BalanceErrorBanner` shown; user cannot proceed to execution.
6. "Execute orders" button opens a non-dismissible `ConfirmDialog` showing: order count, platform name, total estimated value. Closing only possible via Cancel or Confirm buttons.
7. **Step 3 — Alpaca result:** Shows per-order status: `executed ✓`, `skipped`, or `failed`. Total counts shown.
8. After execution: TanStack Query invalidates `['holdings', siloId]` and `['sessions', siloId]`.

---

## Tasks

- [ ] Write `app/(dashboard)/silos/[silo_id]/rebalance/page.tsx` (3-step wizard)
- [ ] Write `components/rebalance/RebalanceConfigPanel.tsx`
- [ ] Write `components/rebalance/OrderReviewPanel.tsx`
- [ ] Write `components/rebalance/ExecutionResultPanel.tsx`
- [ ] Write `components/shared/ConfirmDialog.tsx` (non-dismissible)
- [ ] E2E test: full wizard flow with Alpaca paper trading

---

## Definition of Done

- [ ] All 8 acceptance criteria verified
- [ ] ConfirmDialog: verified non-dismissible (clicking outside + Escape do nothing)
- [ ] `ExecutionModeNotice` appears for non-Alpaca silos (test with a manual silo)
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] `bd close <task-id> "STORY-011b complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] Every page implemented in this story exports a `metadata` object or `generateMetadata` function following the format `[Page Name] | Rebalancify`
