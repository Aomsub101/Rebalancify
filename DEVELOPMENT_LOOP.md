# DEVELOPMENT_LOOP.md — Rebalancify Agent Execution Guide

This file is the **single source of truth** for how every story is implemented.
Claude Code agents must follow this loop exactly for every story, every session.
It consolidates the process rules from KICKSTART.md, CLAUDE.md, and stories/README.md
into one authoritative guide. If this file conflicts with those documents on *process*,
this file wins. If CLAUDE.md conflicts on *code rules*, CLAUDE.md wins.

---

## The Loop (one iteration = one story)

```
┌──────────────────────────────────────────────────────────────────┐
│                    STORY EXECUTION LOOP                          │
│                                                                  │
│  START ──────────────────────────────────────────────────────►   │
│                                                                  │
│  1. ORIENT (every session, no exceptions)                        │
│     Run `bd prime` → loads task state and context               │
│     Run `bd ready` → confirms which stories are unblocked       │
│     Read CLAUDE.md completely                                    │
│     Read PROGRESS.md → find the first story row marked ⬜        │
│     Cross-check: PROGRESS.md and bd ready must agree on next    │
│     Read that story file completely                              │
│     Run `bd update <id> --claim` for the active story           │
│     If any dependency is ⬜ → STOP. Work that story first.       │
│                                                                  │
│  2. PLAN (output before writing any code)                        │
│     State: which story you are implementing                      │
│     List: every file you will create (exact paths)              │
│     List: every file you will modify (what changes)             │
│     Map: each Acceptance Criterion → which code satisfies it    │
│     State your TDD plan for lib/ files:                         │
│       → which test file you will write first for each lib/ file │
│     STOP. Wait for explicit human approval before coding.        │
│                                                                  │
│  3. IMPLEMENT (after approval only)                              │
│     Mandatory order:                                             │
│       a. Database migrations (if any) → run against local DB    │
│       b. Test files (Red phase) → write failing tests first     │
│       c. Implementation code (Green phase) → make tests pass    │
│       d. Refactor → clean code, tests still pass                │
│       e. UI components (after backend is stable)                │
│     NEVER write implementation before the test for lib/ files.  │
│                                                                  │
│  4. QUALITY GATE (automated — run these exact commands)          │
│     pnpm type-check     ← must show 0 TypeScript errors         │
│     pnpm test           ← must show 0 failures                  │
│     pnpm test:coverage  ← must meet minimums in testing doc     │
│     pnpm build          ← must compile with 0 errors            │
│                                                                  │
│  If any gate fails → fix it before proceeding. Never commit     │
│  failing code. Never skip a gate.                                │
│                                                                  │
│  5. VERIFY (story-specific checks)                               │
│     Check each Acceptance Criterion checkbox: is it met?        │
│     Run RLS isolation test for every story touching user tables  │
│     Run security test for EPIC-03, EPIC-04, EPIC-09 stories     │
│     Verify light mode + dark mode rendering for UI stories      │
│     Verify 375px (mobile) + 1280px (desktop) for UI stories    │
│                                                                  │
│  6. COMMIT                                                       │
│     git add -A                                                   │
│     git commit -m "feat(rebalancify): STORY-XXX [short title]"  │
│     git pull --rebase                                            │
│     bd dolt push                                                 │
│     git push                                                     │
│     → GitHub Actions CI will run automatically                  │
│     → Wait for CI green ✅ before marking story complete        │
│                                                                  │
│  7. MARK COMPLETE                                                │
│     Run `bd close <id> "STORY-XXX complete — all DoD passed"   │
│     In PROGRESS.md: change ⬜ to ✅ for this story + add date   │
│     In CLAUDE.md Section 5: update "Active Story" line          │
│     In PROJECT_LOG.md: add entry at TOP of Completed Stories    │
│       using the entry template in that file                      │
│     git add -A                                                   │
│     git commit -m "docs: mark STORY-XXX complete in PROGRESS    │
│       + PROJECT_LOG"                                             │
│     git pull --rebase                                            │
│     bd dolt push                                                 │
│     git push                                                     │
│                                                                  │
│  ────────────────────────────────────────────────────── END      │
│  Return to START. Read PROGRESS.md. Pick next ⬜ story.          │
└──────────────────────────────────────────────────────────────────┘
```

---

## Section 1 — Starting a New Session

Paste this as your first message in every Claude Code session:

```
I am implementing [STORY-XXX: title].

Before writing any code, I will:
1. Run `bd prime` to load current task state
2. Run `bd ready` to confirm which story to work on next
3. Read DEVELOPMENT_LOOP.md completely (the authoritative process guide)
4. Read CLAUDE.md completely (code rules — I must not assume I remember them)
5. Read PROGRESS.md and cross-check it agrees with `bd ready`
6. Read stories/[EPIC-XX-name]/STORY-XXX.md completely
7. Scan PROJECT_LOG.md — read the last 3–5 entries to understand recent decisions
8. Run `bd update <id> --claim` for the story I am implementing
9. Read each file listed in the story's Technical Context section
10. Output my implementation plan including my TDD plan for lib/ files
11. Stop and wait for your explicit approval before writing any code

I will NOT write any code until you approve my plan.
```

---

## Section 2 — Resume Protocol (Interrupted Session)

If a session was interrupted mid-story:

1. Run `bd prime` — this shows the claimed/in-progress task.
2. Run `bd ready` — cross-check with PROGRESS.md.
3. Read this file (DEVELOPMENT_LOOP.md).
4. Read PROGRESS.md → find the story marked 🟡 In Progress, or the last ⬜ story if none are In Progress.
5. Read CLAUDE.md Section 5 — "Active Story" — as a cross-check. If PROGRESS.md and CLAUDE.md disagree, **PROGRESS.md is authoritative**.
6. Read the active story file. Scan the Tasks checkboxes:
   - ✅ Checked tasks are done — do not re-implement them.
   - ⬜ Unchecked tasks are pending — start from the first unchecked one.
7. Run `pnpm type-check` and `pnpm test` to confirm the current state of the codebase is clean.
8. Resume from the first unchecked task.

**Never start from scratch when resuming.** Never re-implement completed tasks. The checkboxes in the story file are the source of truth for what has been done.

---

## Section 3 — Quality Gate Reference

**Never skip. Never bypass. Never "I'll fix it in the next story."**

| Command                | Must Show                                 | Action if Fails                     |
| ---------------------- | ----------------------------------------- | ----------------------------------- |
| `pnpm type-check`    | 0 TypeScript errors                       | Fix type errors before proceeding   |
| `pnpm test`          | 0 failures, 0 errors                      | Fix failing tests before proceeding |
| `pnpm test:coverage` | Coverage meets minimums (see testing doc) | Add missing tests                   |
| `pnpm build`         | Compiled successfully, 0 errors           | Fix build errors before proceeding  |

Run all four in sequence. Only commit when all four are clean.

---

## Section 4 — TDD Checklist (for lib/ files)

Before writing any function in `lib/`:

```
□ I have created the test file at lib/[name].test.ts
□ I have written at least one failing test (Red)
□ I have run pnpm test and confirmed the test fails with the expected error
□ I am now writing implementation code (Green)
□ The test now passes
□ I have refactored the code without breaking the test
□ Coverage meets the minimum for this file
```

---

## Section 5 — Commit Message Format

```
feat(rebalancify): STORY-001 Supabase setup + all 18 migrations
feat(rebalancify): STORY-002 Next.js scaffold + auth flow
fix(rebalancify): STORY-005 correct silo limit error code
test(rebalancify): STORY-009 add encryption round-trip tests
docs: mark STORY-001 complete in PROGRESS.md
chore: update PROGRESS.md active story to STORY-002
```

Format: `type(scope): STORY-XXX brief description`

Types: `feat` (new functionality), `fix` (bug), `test` (tests only), `docs` (documentation), `chore` (maintenance), `refactor` (no behaviour change)

---

## Section 6 — Stuck? Escalation Protocol

If implementation is blocked for more than one attempt:

```
Tell the developer:
"I am stuck on [specific problem] in STORY-XXX.
Here is what I have tried:
1. [approach 1] — result: [what happened]
2. [approach 2] — result: [what happened]
I need guidance on: [specific question]"
```

Never silently produce broken code. Never assume a workaround is acceptable.
If a workaround is the only option, describe it explicitly and ask for approval.

---

## Section 7 — Story Type Quick Reference

| Story involves...                           | Extra steps                                                             |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| Database schema change                      | Run migration locally first; verify RLS before Quality Gate             |
| New API route                               | Test unauthenticated (401) + happy path + error case + RLS isolation    |
| Broker API keys (EPIC-03, EPIC-04, EPIC-09) | Manual security test: zero browser requests to external API             |
| UI component                                | Verify light + dark mode; verify 375px + 1280px; verify focus rings     |
| pg_cron job                                 | Test by running the SQL manually in Supabase SQL Editor                 |
| Vercel Cron Job                             | Test by curling the endpoint with CRON_SECRET header                    |
| Phase completion                            | Run Lighthouse CI on Vercel preview URL                                 |
| Any conflict between two docs               | Look up `CONFLICT_RESOLVER.md` Section 1 — Authority Hierarchy       |
| Any runtime error blocking progress         | Look up `CONFLICT_RESOLVER.md` Section 3 — Runtime Error Resolution  |
| Starting a new session                      | `bd prime` then `bd ready` before reading any story file            |
| Claiming a task                             | `bd update <id> --claim` after reading the story, before writing code |
| Completing a task                           | `bd close <id> "<note>"` as first action in Step 7                    |
| Discovering a new dependency                | `bd dep add <child> <parent>` immediately, before continuing          |
