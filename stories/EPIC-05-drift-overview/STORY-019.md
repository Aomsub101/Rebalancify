# STORY-019 — Overview Page

## AGENT CONTEXT

**What this file is:** A user story specification for the Overview page — PortfolioSummaryCard, GlobalDriftBanner, SiloCardGrid with USD toggle, and silo count badge. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F2-R1 (overview aggregation), F2-R2 (drift banner), F2-R3 (silo card list)
**Connected to:** `docs/architecture/02-database-schema.md` (silos, holdings — aggregated read), `docs/architecture/03-api-contract.md` (silos list and drift endpoints), `docs/architecture/04-component-tree.md` (PortfolioSummaryCard, GlobalDriftBanner, SiloCardGrid, SiloCard)
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-05 — Drift & Overview
**Phase:** 4
**Estimate:** 1 developer-day
**Status:** 🔲 Not started
**Depends on:** STORY-017, STORY-018
**Blocks:** Nothing in Phase 4

---

## User Story

As a user, I can see all my silos aggregated on a single Overview page, with portfolio total, drift summary, and top movers preview.

---

## Acceptance Criteria

1. Overview page renders `PortfolioSummaryCard`: total portfolio value (across all active silos), active silo count `[X/5]`, total unique assets.
2. `GlobalDriftBanner` appears (red) only when at least one asset in any silo is drift-breached. Lists ticker + drift amount.
3. `SiloCardGrid` shows all active silos. Clicking a card navigates to `/silos/[silo_id]`.
4. Each `SiloCard` shows: name, platform badge, execution mode tag, total value, drift state summary.
5. `AlpacaLiveBadge` shown on Alpaca silo card when `alpaca_mode = 'live'`.
6. When zero silos: `EmptyState` with "Create your first silo" CTA.
7. `LoadingSkeleton` during initial data load.
8. `SiloCountBadge` in sidebar shows correct count.

---

## Tasks

- [ ] Write `app/(dashboard)/overview/page.tsx`
- [ ] Write `PortfolioSummaryCard`, `GlobalDriftBanner` components
- [ ] Verify SiloCard shows drift summary from `GET /api/silos/:id/drift`
- [ ] E2E test: create silo → Overview shows it

---

## Definition of Done

- [ ] All 8 acceptance criteria verified
- [ ] GlobalDriftBanner test: manually set drift > threshold → verify banner appears
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] `bd close <task-id> "STORY-019 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] Every page implemented in this story exports a `metadata` object or `generateMetadata` function following the format `[Page Name] | Rebalancify`
