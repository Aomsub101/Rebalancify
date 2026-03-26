# STORY-032b — Research Endpoint: Allocation Guard & Provider Unit Tests

## AGENT CONTEXT

**What this file is:** A user story specification for the allocation percentage output guard, research session cache invalidation on refresh, and unit tests for all 6 LLM provider routings. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F3-R7 (allocation guard), F3-R5 (session caching), F3-R6 (all provider routing)
**Connected to:** `docs/architecture/02-database-schema.md` (research_sessions), `lib/llmRouter.ts` (created in STORY-032), `docs/prd/features/F3-ai-research-hub.md`
**Critical rules for agents using this file:**
- Do not start implementation until STORY-032 is marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-09 — AI Research Hub
**Phase:** 8
**Estimate:** 2 developer-days
**Status:** 🔲 Not started
**Depends on:** STORY-032 (research endpoint base implementation)
**Blocks:** STORY-033

---

## User Story

As a developer, the research endpoint correctly detects and rejects allocation percentage recommendations from LLM output, properly handles cache invalidation on forced refresh, and all 6 provider routings have passing unit tests.

---

## Acceptance Criteria

1. **Allocation percentage detection:** If LLM output contains a percentage allocation recommendation (regex: `\d+\.?\d*\s*%` in proximity to allocation language), backend rejects it with HTTP 422 and `code: "LLM_ALLOCATION_OUTPUT"`.
2. **Forced refresh:** When user requests refresh on a cached session, the existing `research_sessions` row is superseded (new row inserted with `refreshed_at` populated). Old row is not updated.
3. All 6 provider routings have unit tests (at minimum mock tests): anthropic, openai, google, groq, deepseek, openrouter.
4. Security: zero browser requests to any LLM provider endpoint.
5. RLS: `research_sessions` rows only readable by the owning user.

---

## Tasks

- [ ] Write allocation percentage detection logic in research route
- [ ] Write research session cache invalidation on refresh (insert new row, not UPDATE)
- [ ] Write unit tests for all 6 provider routings (mock tests acceptable)
- [ ] Test: allocation percentage in output → 422 `LLM_ALLOCATION_OUTPUT`
- [ ] Security test: zero browser requests to LLM provider endpoints
- [ ] RLS test

---

## Definition of Done

- [ ] All 5 acceptance criteria verified
- [ ] All 6-provider unit tests passing
- [ ] Allocation detection test documented
- [ ] Security test documented
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] `bd close <task-id> "STORY-032b complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
