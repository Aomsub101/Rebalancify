# CONFLICT_RESOLVER.md — Agent Conflict Resolution Guide

**What this file is:** A single-lookup reference for any agent encountering a
conflict between documents, a runtime error, or an unexpected implementation
situation. This file maps the existing authority hierarchy and provides
step-by-step resolution procedures for predictable conflict scenarios.

**This file is NOT a new authority layer.** It consolidates authority statements
that already exist across the documentation. When this file appears to conflict
with any document listed in the authority hierarchy below, the document wins —
not this file.

**When to read this file:** Read it when you encounter a conflict, an error you
cannot resolve, or an instruction that contradicts another instruction. Do not
read it at the start of every session — it is a reference, not a startup document.

---

## Section 1 — The Authority Hierarchy

| Topic | Winning Document | Notes |
|-------|-----------------|-------|
| **Code rules** (patterns, forbidden patterns, naming conventions) | `CLAUDE.md` Critical Rules | If a story contradicts a CLAUDE.md rule, the rule wins. Document the deviation in PROJECT_LOG. |
| **Database column names, table names, constraints, RLS** | `docs/architecture/02-database-schema.md` | If the API contract uses a field name that differs from the schema column name, fix the API contract — never the schema. |
| **Process** (how to run a story, quality gates, commit order) | `DEVELOPMENT_LOOP.md` | If a story's DoD conflicts with the loop (e.g., suggests committing before quality gates pass), follow the loop. |
| **What is currently active / what is done** | `PROGRESS.md` | If `CLAUDE.md` Section 5 shows a different active story than `PROGRESS.md`, use `PROGRESS.md` and update CLAUDE.md to match. |
| **CSS variables and Tailwind tokens** | `docs/design/05-theme-implementation.md` | If `CLAUDE_FRONTEND.md` lists a different token value, fix `CLAUDE_FRONTEND.md` to match. |
| **Component names** | `docs/architecture/04-component-tree.md` | If a PRD feature file uses a different component name, the component tree wins. |
| **Feature requirements (implementation-facing)** | `docs/prd/features/F[N]-*.md` | These are the working specification. `PRD_v1.3.md` at the root is read-only historical context. If they conflict, follow `docs/prd/features/`. |
| **Story implementation scope** | The active story's Acceptance Criteria | Do not implement anything outside the story's ACs. New work → new story. |
| **Task completion status within a story** | Story file checkbox state | Checked = done. Unchecked = pending. Story checkboxes are the source of truth on resume. |
| **Which story to work on next** | `bd ready` output (cross-checked with PROGRESS.md) | If `bd ready` and PROGRESS.md disagree, PROGRESS.md wins for human history; `bd ready` wins for unblocked task selection. |

---

## Section 2 — Document Conflict Scenarios

### 2.1 — Schema column name conflicts with API contract field name

**Resolution:**
1. The schema (`02-database-schema.md`) wins.
2. Fix the API contract in the current session if the story touches that endpoint.
3. Log in PROJECT_LOG: "Naming mismatch between schema and API contract on [field]. Fixed API contract to match schema."

---

### 2.2 — CLAUDE.md Critical Rule conflicts with a story's Acceptance Criteria

**Resolution:**
1. CLAUDE.md wins. Implement using the correct pattern that satisfies the AC's intent.
2. Example: AC says "form submits on Enter" but Rule 1 forbids `<form>` tags → handle `onKeyDown` Enter on a controlled input.
3. Log in PROJECT_LOG: "Story AC [X] implied [forbidden pattern]. Implemented per CLAUDE.md Rule [N]."

---

### 2.3 — Two documents give different values for the same implementation detail

**Resolution:**
1. Use the dedicated/specific document over the summary document.
2. Example: `04-ux-patterns.md` (specific) vs `CLAUDE_FRONTEND.md` (summary) → use `04-ux-patterns.md`.
3. Log the conflict in PROJECT_LOG and flag for a documentation cleanup pass.
4. Do NOT modify both files in the same session.

---

### 2.4 — A story instruction contradicts the DEVELOPMENT_LOOP.md process

**Resolution:**
1. `DEVELOPMENT_LOOP.md` wins on process. The story text is outdated.
2. Example: A story says "implement first, then test" but the loop mandates TDD → follow TDD.

---

### 2.5 — `PRD_v1.3.md` contradicts a `docs/prd/features/` file

**Resolution:**
1. The `docs/prd/features/F[N]-*.md` file is the current working specification.
2. `PRD_v1.3.md` is the original source document — read-only reference only.
3. Implement per `docs/prd/features/`. Log the conflict in PROJECT_LOG.

---

### 2.6 — `bd ready` and `PROGRESS.md` show different next stories

**Symptoms:** `bd ready` shows STORY-006 as unblocked but PROGRESS.md shows STORY-005
as ⬜ (not yet complete).

**Resolution:**
1. This usually means a `bd close` was missed when completing a story.
2. Check PROGRESS.md: if STORY-005 is actually ✅ in the file but `bd` does not
   know it, run `bd close <story005_id> "completed — PROGRESS.md updated"`.
3. If STORY-005 is genuinely ⬜ in PROGRESS.md, work STORY-005 first.
   PROGRESS.md is authoritative for human history.
4. After resolving, re-run `bd ready` to confirm the graph is correct.

---

## Section 3 — Runtime Error Resolution

### 3.1 — TypeScript errors during `pnpm type-check`

1. Read the full error message. Fix in source.
2. Never suppress with `// @ts-ignore` or `// @ts-expect-error` without explicit human approval.
3. Never use `any` to silence errors without a comment explaining why.
4. After two failed fix attempts → escalate (Section 4).

**Never commit TypeScript errors.**

---

### 3.2 — Test failures during `pnpm test`

**Red phase (TDD — you just wrote the test, no implementation yet):**
Expected. Confirm the failure message matches what you intended. Proceed to implement.

**Green phase (implementation done, test should pass):**
Fix the implementation, not the test. The test defines the contract.

**Regression (previously passing test now fails after your changes):**
1. You introduced a regression. Do not commit.
2. Fix your implementation to restore the existing test.
3. If architecturally incompatible → escalate. Do not modify the existing test.

**Never** delete a failing test, skip it with `test.skip()`, or lower coverage thresholds.

---

### 3.3 — Supabase migration already exists when a story says to create it

1. Query `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`
2. If table exists AND matches `02-database-schema.md`: task is already done. Mark it complete.
3. If table exists but is missing columns: write an incremental migration to add them. Do NOT drop/recreate.
4. Never run `supabase db reset` against anything other than a local empty dev environment.

---

### 3.4 — RLS isolation test fails (user B can read user A's data)

**This is a critical security failure. Do not mark the story complete.**

1. Confirm RLS is active: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = '[table]';` — must be `TRUE`.
2. Inspect the policy expression in `02-database-schema.md`. The WHERE clause must use `auth.uid()` matching the `user_id` column.
3. Re-run the migration SQL for the policy.
4. Repeat the isolation test. Do not proceed until it passes.

---

### 3.5 — Partial migration failure (mid-sequence)

1. Do NOT run subsequent migrations.
2. Diagnose the root cause (missing extension, wrong dependency order).
3. Fix the root cause.
4. Write a compensating migration that drops only what the failed migration created.
5. Run the compensating migration, then re-run the failed migration only.
6. Continue from the next migration in sequence.
7. See the full Migration Safety Protocol in `stories/EPIC-01-foundation/STORY-001.md`.

---

### 3.6 — Build fails during `pnpm build`

1. Read the full error. Common causes: type errors, missing environment variables, import errors.
2. For missing env variables: add a placeholder to `.env.local` for build completion.
3. For import errors: check correct paths in `docs/development/00-project-structure.md`.
4. Do NOT commit a failing build. Fix before proceeding.

---

### 3.7 — Story scope creep discovered during implementation

1. Do NOT expand the current story's scope.
2. Implement the minimum that satisfies the current story's ACs.
3. Document the discovered complexity in PROJECT_LOG under "Discovered issues."
4. After marking the current story complete, create a new story for the additional work.
5. Add the new story to `stories/epics.md` and `PROGRESS.md`.

---

### 3.8 — Implementation requires a DB column not in the schema

1. Do NOT add the column to code before documenting it.
2. Stop. Update `docs/architecture/02-database-schema.md` with the new column.
3. Write a new SQL migration file. Run it.
4. Then continue the implementation.
5. Document in PROJECT_LOG.
6. Never write code that references a DB column not in `02-database-schema.md`.

---

## Section 4 — Escalation Protocol

If a conflict cannot be resolved after following the above procedures, stop and
escalate using this format (full procedure: `DEVELOPMENT_LOOP.md` Section 6):

```
"I am stuck on [specific problem] in STORY-XXX.

Here is what I have tried:
1. [approach 1] — result: [what happened]
2. [approach 2] — result: [what happened]

The conflict is between:
- [Document A] which says [X]
- [Document B] which says [Y]

I need guidance on: [specific question]"
```

**Always escalate immediately (do not attempt resolution) when:**
- Two documents with equal claimed authority give irreconcilable instructions
- A CLAUDE.md Critical Rule is physically impossible to satisfy given current code state
- A migration failure destroyed data in a non-dev Supabase project
- A security test confirms user data is leaking despite RLS being active

---

## Section 5 — Quick Reference Card

```
AUTHORITY (fast lookup):
  Code rules           → CLAUDE.md wins
  Schema names         → 02-database-schema.md wins
  Process/loop         → DEVELOPMENT_LOOP.md wins
  Active story         → PROGRESS.md wins
  CSS tokens           → 05-theme-implementation.md wins
  Component names      → 04-component-tree.md wins
  Feature specs        → docs/prd/features/*.md wins (PRD_v1.3.md = read-only ref)
  Session end / push   → AGENTS.md wins (bd dolt push before git push — mandatory)
  Shell command style  → AGENTS.md wins (always use -f/-rf flags)

IF CONFLICT:  follow hierarchy → log in PROJECT_LOG → continue
IF BLOCKED:   stop → write escalation message → wait for human
IF TS ERROR:  fix in source, never @ts-ignore
IF TEST FAIL: fix implementation, never delete test
IF BUILD FAIL: fix before committing, never skip
```
