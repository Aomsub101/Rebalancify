# STORY-007 — Manual Holdings Entry & Silo Detail Page

## AGENT CONTEXT

**What this file is:** A user story specification for manual holdings CRUD, the silo detail page with holdings table, inline editing, and drift badge display. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F2-R3 (manual holdings entry), F2-R4 (holdings display), F2-R8 (silo detail layout)
**Connected to:** `docs/architecture/02-database-schema.md` (holdings, price_cache tables), `docs/architecture/03-api-contract.md` (holdings endpoints), `docs/architecture/04-component-tree.md` (HoldingsTable, HoldingRow, SiloHeader, DriftBadge)
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-02 — Silos & Holdings
**Phase:** 1
**Estimate:** 2 developer-days
**Status:** 🔲 Not started
**Depends on:** STORY-006
**Blocks:** STORY-008, STORY-009

---

## User Story

As a user with a manual silo, I can enter and update holdings quantities and cash balance, and see all derived values (current value, weight %, drift) in the holdings table.

---

## Acceptance Criteria

1. `GET /api/silos/:id/holdings` returns all holdings with: `current_price`, `current_value`, `current_weight_pct`, `target_weight_pct`, `drift_pct`, `drift_breached`, `stale_days`, `source`.
2. `POST /api/silos/:id/holdings` creates a holding. A `price` field in the request body is ignored — price always comes from `price_cache`.
3. `PATCH /api/silos/:id/holdings/:id` updates `quantity` or `cost_basis`. Returns updated holding.
4. Silo detail page renders: `SiloHeader`, `SiloSummaryBar`, `WeightsSumBar`, `HoldingsTable`, `CashBalanceRow`, "Add asset" button, "Run rebalance" button.
5. `HoldingRow` shows: ticker, name, quantity, current value, current weight %, target weight %, drift badge (green/yellow/red with icon).
6. Editing quantity inline (click → input → blur → save) calls `PATCH` and updates the table optimistically.
7. `StalenessTag` appears on holdings where `stale_days > 7` (manual silos only).
8. `WeightsSumBar` fills proportionally. Turns amber and shows `WeightsSumWarning` when `weights_sum_pct ≠ 100`.
9. `EmptyState` shown when silo has zero holdings.
10. `LoadingSkeleton` shown during `GET /api/silos/:id/holdings` pending state.
11. `ErrorBanner` shown if the request fails.
12. RLS: user B cannot GET or PATCH user A's holdings.

---

## Tasks

- [ ] Write `app/api/silos/[silo_id]/holdings/route.ts` (GET, POST)
- [ ] Write `app/api/silos/[silo_id]/holdings/[holding_id]/route.ts` (PATCH)
- [ ] Write `app/(dashboard)/silos/[silo_id]/page.tsx`
- [ ] Write `components/silo/HoldingsTable.tsx`
- [ ] Write `components/silo/HoldingRow.tsx` (inline edit for manual silos)
- [ ] Write `components/silo/SiloHeader.tsx`
- [ ] Write `components/shared/DriftBadge.tsx` (three-state, with icons)
- [ ] Write `components/shared/LoadingSkeleton.tsx`
- [ ] Write `components/shared/EmptyState.tsx`
- [ ] Write `components/shared/ErrorBanner.tsx`
- [ ] Write `lib/formatNumber.ts` (all format types)
- [ ] Unit tests for `formatNumber` (all cases + edge cases)
- [ ] Verify price-from-request-body is ignored (test POST with price field → uses cache price)

---

## Definition of Done

- [ ] All 12 acceptance criteria verified
- [ ] `formatNumber` unit tests all passing
- [ ] DriftBadge has icon on all three states
- [ ] No inline number formatting anywhere (grep: `/\.toFixed\(/` in components should return zero hits)
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] `bd close <task-id> "STORY-007 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] Every page implemented in this story exports a `metadata` object or `generateMetadata` function following the format `[Page Name] | Rebalancify`
