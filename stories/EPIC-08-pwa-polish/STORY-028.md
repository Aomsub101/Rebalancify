# STORY-028 — Onboarding Modal & Progress Banner

## AGENT CONTEXT

**What this file is:** A user story specification for the first-login onboarding modal (platform selection → silo creation) and the post-onboarding progress banner. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** PRD Section 6 (Onboarding flow), design_preferences.md onboarding section
**Connected to:** `docs/architecture/02-database-schema.md` (user_profiles.onboarded column), `docs/architecture/03-api-contract.md` (profile onboarded field, silo creation), `docs/architecture/04-component-tree.md` (OnboardingModal, ProgressBanner), `docs/design/03-screen-flows.md` (Onboarding Modal layout)
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-08 — PWA & Polish
**Phase:** 7
**Estimate:** 1 developer-day
**Status:** 🔲 Not started
**Depends on:** STORY-027, STORY-005 (silo creation)
**Blocks:** STORY-029

---

## User Story

As a first-time user, I am guided through platform selection and silo creation immediately after signup, then prompted to complete my first portfolio setup via a non-intrusive progress banner.

---

## Acceptance Criteria

1. The onboarding modal appears exactly once — on first login after email verification, when `user_profiles` has no active silos.
2. Modal shows 7 platform options as selectable cards: Alpaca, BITKUB, InnovestX, Schwab, Webull, DIME, and "Other (enter manually)".
3. Selecting a platform and clicking "Create silo" calls `POST /api/silos` with the correct `platform_type` and `base_currency` defaults. Specific values per platform choice:
   - Alpaca → `{ name: "Alpaca Portfolio", platform_type: "alpaca", base_currency: "USD" }`
   - BITKUB → `{ name: "BITKUB", platform_type: "bitkub", base_currency: "THB" }`
   - InnovestX → `{ name: "InnovestX", platform_type: "innovestx", base_currency: "THB" }`
   - Schwab → `{ name: "Charles Schwab", platform_type: "schwab", base_currency: "USD" }`
   - Webull → `{ name: "Webull", platform_type: "webull", base_currency: "USD" }`
   - DIME → `{ name: "DIME", platform_type: "manual", base_currency: "THB" }` — DIME is permanently manual; the `PlatformBadge` for this silo shows "DIME" (not "MANUAL") based on the silo `name` field.
   - Other → `{ name: "[user-entered name]", platform_type: "manual", base_currency: "USD" }` — shows generic "MANUAL" badge.
4. After silo creation: modal closes, user is navigated to `/silos/[new_silo_id]`, and the progress banner appears.
5. "Skip for now" dismisses the modal without creating a silo. User lands on Overview. No progress banner shown.
6. After dismissal (skip OR completion): the modal never appears again. Tracked via `user_profiles.onboarded = TRUE` (set server-side).
7. Progress banner is shown when: `onboarded = TRUE` and active silo exists but has zero holdings. Banner reads: `● Add holdings → ○ Set target weights → ○ Run first rebalance`.
8. Progress banner is dismissible via X button. Dismissal is stored via `PATCH /api/profile` setting a `progress_banner_dismissed` flag — NOT localStorage. After dismiss: never shown again on any device.
9. Progress steps update reactively: step changes to filled when the corresponding action is completed.
10. Modal is not dismissible by clicking outside or pressing Escape (same rule as ConfirmDialog).

---

## Tasks

- [ ] Write `OnboardingModal` component (7 platform cards, Skip + Create buttons)
- [ ] Add `onboarded` column to `user_profiles` (migration or PATCH)
- [ ] Wire modal to `SessionContext`: show when `onboarded = FALSE` and `active_silo_count = 0`
- [ ] Write `ProgressBanner` component (3-step, dismissible)
- [ ] Wire progress steps to TanStack Query state (holdings count, weights sum, session history count)
- [ ] Test: modal shown on first login → not shown on second login
- [ ] Test: skip → no modal on refresh
- [ ] Test: progress banner dismiss persists across page reload

---

## Definition of Done

- [ ] All 10 acceptance criteria verified
- [ ] Modal non-dismissible test: ESC and backdrop click do nothing
- [ ] Progress banner dismiss persists after hard refresh
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] `bd close <task-id> "STORY-028 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] Every page implemented in this story exports a `metadata` object or `generateMetadata` function following the format `[Page Name] | Rebalancify`
