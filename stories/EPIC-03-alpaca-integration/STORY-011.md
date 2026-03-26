# STORY-011 — Rebalancing Wizard UI & Alpaca Order Execution

## AGENT CONTEXT

**What this file is:** A user story specification for the 3-step rebalancing wizard UI and Alpaca order execution endpoint. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F1-R9 (order review wizard), F1-R10 (Alpaca execution, session status transition)
**Connected to:** `docs/architecture/02-database-schema.md` (rebalance_sessions status transitions, rebalance_orders alpaca_order_id), `docs/architecture/03-api-contract.md` (execute endpoint), `docs/architecture/04-component-tree.md` (RebalanceConfigPanel, OrderReviewPanel, ExecutionResultPanel, ConfirmDialog)
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-03 — Alpaca Integration
**Phase:** 2
**Estimate:** 3 developer-days (maximum per-story limit reached — this story must be split before implementation begins; see splitting guidance added to Notes section below)
**Status:** 🔲 Not started
**Depends on:** STORY-010
**Blocks:** STORY-012

---

## User Story

As an Alpaca user, I can walk through the 3-step rebalancing wizard, review all calculated orders, confirm execution, and see the result with per-order status.

---

## Acceptance Criteria

1. Rebalancing wizard has 3 steps with a `StepIndicator`: Config → Review → Result.
2. **Step 1 — Config:** Mode selector rendered as radio cards (not dropdown). `FullRebalanceWarning` shown when mode = full. Cash toggle + amount input. `WeightsSumWarning` shown when weights ≠ 100%.
3. **Step 2 — Review:** `OrdersTable` with all orders. Each `OrderRow` shows: ticker, order type badge (BUY green / SELL red), quantity, estimated value, weight arrow (before → after), skip checkbox.
4. **Step 2 — Non-Alpaca banner:** `ExecutionModeNotice` shown for non-Alpaca silos. Non-dismissible.
5. **Step 2 — Balance error:** If `balance_valid: false`, `BalanceErrorBanner` shown; user cannot proceed to execution.
6. "Execute orders" button opens a non-dismissible `ConfirmDialog` showing: order count, platform name, total estimated value. Closing only possible via Cancel or Confirm buttons.
7. `POST /api/silos/:id/rebalance/execute` for Alpaca: submits approved orders to Alpaca API. Stores `alpaca_order_id` on each executed `rebalance_orders` row.
8. **Step 3 — Alpaca result:** Shows per-order status: `executed ✓`, `skipped`, or `failed`. Total counts shown.
9. Security: all Alpaca order calls go through `/api/silos/:id/rebalance/execute`. Zero browser requests to `api.alpaca.markets`.
10. After execution: TanStack Query invalidates `['holdings', siloId]` and `['sessions', siloId]`.

---

## Tasks

- [ ] Write `app/(dashboard)/silos/[silo_id]/rebalance/page.tsx` (3-step wizard)
- [ ] Write `components/rebalance/RebalanceConfigPanel.tsx`
- [ ] Write `components/rebalance/OrderReviewPanel.tsx`
- [ ] Write `components/rebalance/ExecutionResultPanel.tsx`
- [ ] Write `app/api/silos/[silo_id]/rebalance/execute/route.ts` (Alpaca + manual)
- [ ] Write `components/shared/ConfirmDialog.tsx` (non-dismissible)
- [ ] E2E test: full wizard flow with Alpaca paper trading
- [ ] Security test: DevTools shows zero requests to alpaca.markets

---

## Definition of Done

- [ ] All 10 acceptance criteria verified
- [ ] ConfirmDialog: verified non-dismissible (clicking outside + Escape do nothing)
- [ ] Security test documented
- [ ] `ExecutionModeNotice` appears for non-Alpaca silos (test with a manual silo)
- [ ] `bd close <task-id> "STORY-011 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
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

- **STORY-011a:** `POST /rebalance/execute` API route — Alpaca submission, order ID storage, session status update
- **STORY-011b:** Full 3-step wizard UI (RebalanceConfigPanel, OrderReviewPanel, ExecutionResultPanel, ConfirmDialog)

Create `STORY-011b.md` as a sibling file in `EPIC-03-alpaca-integration/` before starting STORY-011a. Add both to `stories/epics.md` and `PROGRESS.md`.
