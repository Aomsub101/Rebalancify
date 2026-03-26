# STORY-005 — Profile API + Silo CRUD + List Page

## AGENT CONTEXT

**What this file is:** A user story specification for building the profile API, silo CRUD endpoints, silos list page, and Settings profile/notification sections. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F2-R1, F2-R2, F2-R3, F2-R7 (silo management), F2-R8 (settings)
**Connected to:** `docs/architecture/02-database-schema.md` (user_profiles, silos tables), `docs/architecture/03-api-contract.md` (profile and silos endpoints), `docs/architecture/04-component-tree.md` (SiloCard, Settings sections)
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-02 — Silos & Holdings
**Phase:** 1
**Estimate:** 2 developer-days
**Status:** 🔲 Not started
**Depends on:** STORY-001 (schema), STORY-003 (AppShell)
**Blocks:** STORY-006, STORY-007, STORY-008

---

## User Story

As a user, I can create, rename, and delete platform silos (up to 5), and set my display name and notification preferences in Settings.

---

## Acceptance Criteria

1. `GET /api/profile` returns profile shape per `docs/architecture/03-api-contract.md`. `active_silo_count` and `silo_limit: 5` are included.
2. `PATCH /api/profile` updates `display_name` and `drift_notif_channel`. Returns updated profile.
3. `GET /api/silos` returns all active silos with derived fields (`total_value: "0.00000000"` until holdings are added).
4. `POST /api/silos` with valid payload creates a silo. Response is HTTP 201 with the new silo object.
5. `POST /api/silos` when user already has 5 active silos returns HTTP 422 with `code: "SILO_LIMIT_REACHED"`.
6. `DELETE /api/silos/:id` sets `is_active = FALSE`. The silo disappears from `GET /api/silos`.
7. After deletion: `POST /api/silos` succeeds again (active count is now < 5).
8. Silos list page shows all active silos. "Create silo" button is disabled (with tooltip) when count = 5.
9. Create silo form: all 6 `platform_type` options available. Default `base_currency` pre-fills correctly per platform.
10. Settings page: Profile section (display name) and Notifications section (drift_notif_channel) save correctly.
11. `SiloCountBadge` in sidebar updates reactively on silo create/delete (via React Query cache invalidation).
12. RLS isolation test: user B cannot access user A's silos.

---

## Tasks

- [ ] Write `app/api/profile/route.ts` (GET, PATCH)
- [ ] Write `app/api/silos/route.ts` (GET, POST with 5-silo limit check)
- [ ] Write `app/api/silos/[silo_id]/route.ts` (PATCH, DELETE/soft-delete)
- [ ] Write `app/(dashboard)/settings/page.tsx` (Profile + Notifications sections only)
- [ ] Write `app/(dashboard)/silos/page.tsx` + `SiloCardGrid`
- [ ] Write `app/(dashboard)/silos/new/page.tsx` (create silo form)
- [ ] Write `components/silo/SiloCard.tsx`
- [ ] Verify silo limit enforcement (unit test: mock DB count = 5 → expect 422)
- [ ] Verify RLS isolation (two-user DB test)

---

## Definition of Done

- [ ] All 12 acceptance criteria verified
- [ ] Unit test for silo limit (count = 5 → 422)
- [ ] Integration test for RLS isolation
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] `bd close <task-id> "STORY-005 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] Every page implemented in this story exports a `metadata` object or `generateMetadata` function following the format `[Page Name] | Rebalancify`
