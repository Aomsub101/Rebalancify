# STORY-029 — Performance Audit & Polish

## AGENT CONTEXT

**What this file is:** A user story specification for the v1.0 performance and quality audit — all NFR targets, grep audits for forbidden patterns, LoadingSkeleton/EmptyState/ErrorBanner coverage, and Lighthouse CI. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** NFR Section 8 (all non-functional requirements), CLAUDE.md Rules 2, 11, 13, 14, 17
**Connected to:** Every component file (audit target), `docs/design/CLAUDE_FRONTEND.md` (forbidden patterns), `CLAUDE.md` (Rules 6, 7, 14, 17)
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-08 — PWA & Polish
**Phase:** 7
**Estimate:** 2 developer-days
**Status:** 🔲 Not started
**Depends on:** STORY-027, STORY-028
**Blocks:** Nothing — this closes Phase 7 and v1.0

---

## User Story

As a developer, I ensure that all NFR performance targets are met, all data-fetching components have loading and error states, and the product is ready for a v1.0 public release.

---

## Acceptance Criteria

1. **Rebalancing calculation:** `POST /api/silos/:id/rebalance/calculate` for a silo with 50 holdings completes in < 2 seconds. Measured via Vitest timing assertion.
2. **News feed refresh:** `POST /api/news/refresh` + UI render completes in < 3 seconds on a standard connection. Measured via Playwright.
3. **First Contentful Paint:** < 3 seconds on simulated 3G. Measured via Lighthouse CI on Vercel preview URL.
4. **LoadingSkeleton audit:** Every component that calls `useQuery` must render a `LoadingSkeleton` during the `isLoading` state. Audit: grep for `useQuery` → verify each callsite has a `isLoading` branch rendering `<LoadingSkeleton />`.
5. **ErrorBanner audit:** Every component that calls `useQuery` must render `<ErrorBanner />` during the `isError` state. Audit: same grep pattern.
6. **EmptyState audit:** Every list and table component must render `<EmptyState />` when data is an empty array. Audit: code review of all list components.
7. **Colour + icon audit:** Every `DriftBadge` renders both a colour class and an icon. Grep: every `bg-positive-bg`, `bg-warning-bg`, `bg-negative-bg` in DriftBadge.tsx is accompanied by a Lucide icon.
8. **Disclaimer audit:** `grep -r "not financial advice" app/` must return one hit per page layout file (in the footer).
9. **`formatNumber` audit:** Grep `\.toFixed\(` in `components/` must return zero results (all formatting goes through `lib/formatNumber.ts`).
10. **No form tags:** Grep `<form` in `components/` and `app/` must return zero results.
11. **No inline styles:** Grep `style={{` in `components/` must return zero results.
12. Zero TypeScript errors (`pnpm type-check` passes clean).

---

## Tasks

- [ ] Run all grep audits (AC 7–11) and fix violations
- [ ] Add `LoadingSkeleton` and `ErrorBanner` to any components missing them
- [ ] Ensure `EmptyState` in all list components
- [ ] Run Lighthouse CI on Vercel preview → verify FCP < 3s
- [ ] Run rebalancing timing test (50 holdings → < 2s)
- [ ] Run Playwright news timing test
- [ ] Fix all TypeScript errors
- [ ] Final manual walkthrough: create silo → add holdings → set weights → rebalance → view history → news → discover

---

## Audit Commands Reference

```bash
# No form tags
grep -rn "<form" components/ app/ --include="*.tsx" --include="*.ts"

# No inline styles
grep -rn "style={{" components/ app/ --include="*.tsx"

# No toFixed in components
grep -rn "\.toFixed(" components/ --include="*.tsx"

# Disclaimer in every page
grep -rn "not financial advice" app/ --include="*.tsx"

# AiInsightTag not in v1.0 code
grep -rn "AiInsightTag" components/ --include="*.tsx"

# No UPDATE on rebalance_sessions
grep -rn "UPDATE.*rebalance_sessions" . --include="*.ts" --include="*.sql"
```

---

## Definition of Done

- [ ] All 12 acceptance criteria verified
- [ ] All grep audits return expected zero results
- [ ] Lighthouse CI screenshot attached to PR
- [ ] `pnpm type-check` passes with zero errors
- [ ] Final manual walkthrough completed without errors
- [ ] `pnpm test` passes with zero failures
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] `bd close <task-id> "STORY-029 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
- [ ] Every page implemented in this story exports a `metadata` object or `generateMetadata` function following the format `[Page Name] | Rebalancify`
