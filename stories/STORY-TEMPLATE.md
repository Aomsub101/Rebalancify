# STORY-[NNN] — [Story Title]

## AGENT CONTEXT

**What this file is:** A user story specification for [brief description]. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** [Source PRD requirement IDs, e.g., PRD_v1.3.md F1-R3, F2-R1]
**Connected to:** [List of files that must stay consistent — e.g., docs/architecture/02-database-schema.md, docs/architecture/03-api-contract.md]
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.
- If any instruction in this story conflicts with `CLAUDE.md` or `DEVELOPMENT_LOOP.md`, see `CONFLICT_RESOLVER.md` for resolution procedure.

---

## 1. Story Header

| Field | Value |
|---|---|
| **Story ID** | STORY-[NNN] |
| **Title** | [Short imperative title — e.g., "Implement silo CRUD endpoints"] |
| **Epic** | EPIC-[N] — [Epic name] |
| **Status** | Planned / In Progress / In Review / Complete |
| **Assigned to** | — |
| **Estimated effort** | [0.5 / 1 / 2 / 3] developer-days |

---

## 2. User Story

As a **[persona — e.g., self-directed investor]**, I want to **[specific action]**, so that **[user outcome / benefit]**.

---

## 3. Context

**PRD requirements this story implements:**
- [F1-R3]: [Brief quote of the requirement]
- [F2-R1]: [Brief quote of the requirement]

**Why this story exists at this point in the build order:**
[One or two sentences explaining why this must be built now and what it unblocks.]

---

## 4. Dependencies

The following stories must be complete (✅ in PROGRESS.md) before this story starts:

- [ ] STORY-[NNN] — [Title] (provides [what it provides])
- [ ] STORY-[NNN] — [Title] (provides [what it provides])

*If this story has no dependencies, write: "None — this is a foundational story."*

---

## 5. Technical Context

**Database tables used:**
- `[table_name]` — [columns accessed and why] — see `docs/architecture/02-database-schema.md`
- `[table_name]` — [columns accessed and why]

**API endpoints implemented or consumed:**
- `[METHOD /path]` — [what it does] — see `docs/architecture/03-api-contract.md`

**Components implemented or extended:**
- `[ComponentName]` — [what it does] — see `docs/architecture/04-component-tree.md`

**External services called (if any):**
- [Service name] — [endpoint used] — [failure behaviour]

---

## 6. Implementation Tasks

**TDD order is mandatory for all `lib/` business logic.** For each task that creates or modifies a file in `lib/`, write the test file first (Red phase), run it to confirm failure, then implement (Green phase), then refactor.

Tasks must be ordered so that each task can be committed independently. Maximum 1 developer-day per task.

1. **[Database / Migration task]** — [specific action: e.g., "Write SQL migration for `silos` table with all columns from DOC-01 section 3.2. Run via Supabase migration CLI."]
2. **[API route task]** — [specific action: e.g., "Implement `POST /api/silos` route in `app/api/silos/route.ts`. Check active silo count before INSERT. Return 422 `SILO_LIMIT_REACHED` if count >= 5."]
3. **[Service/logic task]** — [specific action]
4. **[Component task]** — [specific action: e.g., "Implement `SiloCard` component with exact Tailwind classes from docs/design/02-component-library.md section on hoverable cards."]
5. **[Test task]** — [specific action: e.g., "Write unit test for silo limit enforcement: assert 422 on 6th silo creation."]

---

## 7. Acceptance Criteria

1. Given [context], when [action], then [specific, testable outcome].

2. Given [context], when [action], then [specific, testable outcome].

3. Given [context], when [action], then [specific, testable outcome].

*Minimum 3 acceptance criteria. Maximum 10. Each must be independently testable. Given/When/Then phrasing is recommended but not required — plain assertions are acceptable.*

---

## 8. Definition of Done

Every item must be checked before marking this story Complete in PROGRESS.md.

- [ ] All acceptance criteria pass
- [ ] Tests written BEFORE implementation for all `lib/` business logic (TDD Red→Green→Refactor cycle followed)
- [ ] Unit tests cover all business logic (rebalancing calculation, drift calculation, price fetching)
- [ ] `pnpm test` passes with zero failures and coverage meets minimums in `docs/development/03-testing-strategy.md`
- [ ] API endpoints tested with at least one happy path and one error path test
- [ ] RLS policy verified — cross-user data leakage is impossible (manual test: query as a different user's JWT)
- [ ] UI renders correctly in both light and dark mode (toggle and verify)
- [ ] UI renders correctly at 375px (mobile) and 1280px (desktop) viewport widths
- [ ] All interactive elements have visible focus ring (`focus-visible:ring-2 focus-visible:ring-ring`)
- [ ] All colour-based states have a secondary non-colour signal (icon or text label)
- [ ] No API keys, monetary values formatted with JavaScript floats, or user PII appear in console logs
- [ ] Skeleton loading state implemented for every data-fetching component in this story
- [ ] Empty state implemented for every list or table component in this story
- [ ] Error state implemented (`ErrorBanner`) for every component that calls an API in this story
- [ ] `bd close <task-id> "STORY-[NNN] complete — all DoD items verified"` run successfully
- [ ] `bd dolt push` run successfully (syncs Beads task graph to remote — see AGENTS.md)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] **For stories that store, transmit, or display API keys/tokens:** Manual security test documented — verified that (1) no key appears in browser DevTools network requests, (2) no key appears in any API response body, (3) key input shows `••••••••` after saving. See `docs/development/03-testing-strategy.md` Manual Security Tests section.
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] Every page implemented in this story exports a `metadata` object or `generateMetadata` function with a meaningful `<title>` following the format `[Page Name] | Rebalancify`

---

## 9. Notes

*Implementation notes, edge cases, known gotchas, links to relevant external docs.*

- [Note 1]
- [Note 2]

*If no notes, write: "No additional notes."*

---

## 10. New Feature Checklist

*Use this section only when creating a story for a feature added after v2.0. For all v1.0 and v2.0 stories, this section is not applicable — leave it as-is.*

When adding a post-v2.0 feature, every item below must be completed before starting any implementation:

- [ ] `docs/prd/features/F[N]-[feature-name].md` created with full requirement specification (all requirements have unique IDs, e.g. F6-R1)
- [ ] `docs/architecture/02-database-schema.md` updated if new tables or columns are required (SQL migration written and tested)
- [ ] `docs/architecture/03-api-contract.md` updated if new endpoints are required (request/response shapes fully documented)
- [ ] `docs/architecture/04-component-tree.md` updated if new components are required (placed correctly in hierarchy)
- [ ] `docs/architecture/05-build-order.md` updated with new phase or tasks (dependency chain verified)
- [ ] `docs/design/02-component-library.md` updated if new component patterns are required (Tailwind className strings specified)
- [ ] `docs/design/03-screen-flows.md` updated with new page layout diagram (desktop + mobile variants)
- [ ] `stories/epics.md` updated with new epic entry (status: planned, stories listed)
- [ ] New EPIC folder created: `stories/EPIC-[N]-[name]/`
- [ ] At least one story file created in the new epic folder using this template
- [ ] `CLAUDE.md` Critical Rules section updated if the new feature introduces new rules that must never be violated
- [ ] `PROGRESS.md` updated to include the new epic in the build tracker table
- [ ] `README.md` updated if the new feature changes the platform support matrix or release roadmap
