# STORY-017 — Portfolio Drift Calculation & Indicator

## AGENT CONTEXT

**What this file is:** A user story specification for the per-asset drift calculation endpoint and the three-state DriftBadge component with icons. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F5-R4 (drift calculation formula), F5-R5 (drift threshold states)
**Connected to:** `docs/architecture/02-database-schema.md` (holdings, target_weights, price_cache, silos drift_threshold), `docs/architecture/03-api-contract.md` (drift endpoint), `docs/architecture/04-component-tree.md` (DriftBadge)
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-05 — Drift & Overview
**Phase:** 4
**Estimate:** 1 developer-day
**Status:** 🔲 Not started
**Depends on:** STORY-007, STORY-008
**Blocks:** STORY-018, STORY-019, STORY-020

---

## User Story

As a user, I can see the current drift of each holding versus its target weight, with a three-state visual indicator and always-present sign.

---

## Acceptance Criteria

1. `GET /api/silos/:id/drift` returns per-asset drift with `drift_pct`, `drift_state` (green/yellow/red), `drift_breached`.
2. Drift formula: `current_weight_pct - target_weight_pct`. Positive = over target. Negative = under target.
3. Green: `ABS(drift_pct) <= drift_threshold`. Yellow: `threshold < ABS <= threshold + 2`. Red: `ABS > threshold + 2`.
4. `drift_threshold` is per-silo (default 5.0). Configurable via `PATCH /api/silos/:id`.
5. Drift is always shown with sign: `+2.18%` or `-1.44%`.
6. `DriftBadge` has icon on all three states: Circle (green), Triangle (yellow), AlertCircle (red).
7. No historical drift data is stored. Every call to `GET /api/silos/:id/drift` is a live computation from `price_cache` + `holdings` + `target_weights`.
8. RLS: user B cannot call `GET /api/silos/:id/drift` for user A's silo.

---

## Tasks

- [ ] Write `app/api/silos/[silo_id]/drift/route.ts`
- [ ] Add `drift_threshold` to silo PATCH endpoint
- [ ] Update `DriftBadge.tsx` to use `drift_state` from API
- [ ] Unit test: all three drift states with threshold = 5.0
- [ ] Unit test: custom threshold

---

## Definition of Done

- [ ] All 8 acceptance criteria verified
- [ ] Unit tests for all three states and custom threshold
- [ ] No `drift_history` table or column anywhere in the codebase (grep)
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] `bd close <task-id> "STORY-017 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
