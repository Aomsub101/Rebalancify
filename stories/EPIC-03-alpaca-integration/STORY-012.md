# STORY-012 — Rebalance History

## AGENT CONTEXT

**What this file is:** A user story specification for paginated rebalancing session history — per-silo and cross-silo endpoints, plus the history page UI. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F1-R11 (session history and audit trail)
**Connected to:** `docs/architecture/02-database-schema.md` (rebalance_sessions, rebalance_orders — read only), `docs/architecture/03-api-contract.md` (history endpoints), `docs/architecture/04-component-tree.md` (history page components)
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-03 — Alpaca Integration
**Phase:** 2
**Estimate:** 1 developer-day
**Status:** 🔲 Not started
**Depends on:** STORY-011
**Blocks:** Nothing

---

## User Story

As a user, I can view the history of all my past rebalancing sessions — per silo or across all silos — with a snapshot of holdings and order statuses at the time of each session.

---

## Acceptance Criteria

1. `GET /api/silos/:id/rebalance/history` returns paginated sessions for one silo. Sessions include: `session_id`, `mode`, `created_at`, `status`, `orders[]` with `execution_status` per order.
2. `GET /api/rebalance/history` returns sessions across all user's silos. Each session includes `silo_name` and `silo_id`.
3. History page at `/silos/:id/history` lists all sessions for that silo. Clicking a session expands `snapshot_before` detail.
4. Sessions are ordered newest first.
5. Sessions are append-only with two narrow exceptions. The application layer never issues UPDATE on `rebalance_sessions` except: (1) `POST /api/silos/:id/rebalance/execute` may write `snapshot_after` after Alpaca execution completes, and (2) `status` may be transitioned from `'pending'` to `'approved'` / `'partial'` / `'cancelled'` by the same endpoint. All other columns are permanently immutable after INSERT. Verified by: confirm no application code calls UPDATE on any other column. The RLS policy must permit service-role UPDATE (for the two exceptions) and must block user-level UPDATE entirely.
6. RLS: user B cannot view user A's session history.

---

## Tasks

- [ ] Write `app/api/silos/[silo_id]/rebalance/history/route.ts`
- [ ] Write `app/api/rebalance/history/route.ts` (cross-silo)
- [ ] Write `app/(dashboard)/silos/[silo_id]/history/page.tsx`
- [ ] Verify no UPDATE statement exists for `rebalance_sessions` (grep codebase)
- [ ] RLS test

---

## Definition of Done

- [ ] All 6 acceptance criteria verified
- [ ] Grep for `UPDATE.*rebalance_sessions` returns zero results
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] `bd close <task-id> "STORY-012 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] Every page implemented in this story exports a `metadata` object or `generateMetadata` function following the format `[Page Name] | Rebalancify`
