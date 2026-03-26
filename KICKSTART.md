# KICKSTART.md — Rebalancify AI Agent Entry Point

## What This File Is

This is the mandatory first read for any Claude Code agent beginning or resuming work on Rebalancify. Read every section before opening any other file or writing any code.

---

## 1. Project Identity

**Name:** Rebalancify
**Purpose:** A free, open-source web application that gives self-directed retail investors a single decision-support hub for tracking, analysing, and rebalancing multi-platform investment portfolios.
**Current Phase:** Phase 0 — Foundation (EPIC-01). No code has been written yet.
**Version target:** v1.0 MVP. v2.0 features (AI Research Hub, multi-platform execution) are documented but not yet implemented.

---

## 2. Document Reading Order

Before starting any story, first run these commands, then read these files:

**Run first:**
```bash
bd prime     # loads task state — tells you what was last worked on
bd ready     # tells you which stories are immediately unblocked
```

**Then read in order:**
1. `KICKSTART.md` ← you are here
2. `AGENTS.md` ← Beads integration rules, mandatory session-end steps, non-interactive shell commands
3. `DEVELOPMENT_LOOP.md` ← the complete agent execution guide (how to start, implement, test, commit, and resume)
4. `CLAUDE.md` ← master rules, tech stack, critical constraints, forbidden patterns
5. `PROGRESS.md` ← what is complete and what is active
6. `PROJECT_LOG.md` ← implementation history: what was built, what was discovered, decisions made (scan last 3–5 entries)
7. `stories/epics.md` ← epic definitions and status
8. The active Story file (e.g., `stories/EPIC-01-foundation/STORY-001.md`)
9. Referenced architecture docs listed in the story's Technical Context section

For UI stories, also read:
- `docs/design/CLAUDE_FRONTEND.md` — complete frontend rules and token quick-reference
- `docs/design/05-theme-implementation.md` — CSS variable values and tailwind.config.js spec

For schema/migration stories, also read:
- `docs/architecture/02-database-schema.md` — authoritative table definitions (this file wins all naming conflicts)

---

## 3. Development Workflow

Before starting ANY story:
1. Confirm all stories listed in the story's Dependencies section are marked ✅ in `PROGRESS.md`.
2. Read the story's Acceptance Criteria fully before writing a single line of code.
3. Read the story's Definition of Done checklist — these are the exit gates.
4. For database stories: run migrations via Supabase CLI, verify RLS before marking complete.
5. For API stories: test happy path and at least one error path before marking complete.

After completing ANY story:
1. Verify every Definition of Done item is checked.
2. Update `PROGRESS.md` — mark the story row ✅ with today's date.
3. Update the "Active Story" line in `CLAUDE.md` Section 5.

---

## 4. Hard Rules (Never Violate)

These rules are absolute. If any instruction elsewhere conflicts with these, these win — except `docs/architecture/02-database-schema.md` which wins on schema specifics.

- No `<form>` tags — use `onClick` + controlled state only.
- All styling via Tailwind classes only — no `style={{}}`, no CSS Modules.
- All monetary values: `NUMERIC(20,8)` in PostgreSQL; string with 8dp in API responses.
- All API keys encrypted with AES-256-GCM before storage; never returned in any response.
- All external API calls proxied through Next.js API routes — never called from client.
- The sidebar is always `bg-sidebar` (dark navy) regardless of colour mode.
- Numeric table cells: always `text-right font-mono tabular-nums`.
- RLS required on every user-data table — verify before marking any story complete.
- Rebalancing sessions: never UPDATE after creation except the two permitted exceptions in `CLAUDE.md` Rule 9.
- Maximum 5 active silos per user — enforced at API layer, not DB constraint.
- `formatNumber()` utility for all numeric display — no inline `.toFixed()`.
- Disclaimer "This is not financial advice" in footer of every page.

Full rule list: `CLAUDE.md` Section 3.
Frontend rules: `docs/design/CLAUDE_FRONTEND.md` Section 1.
Forbidden code patterns: `CLAUDE.md` Section 6.
If two rules conflict or a runtime error blocks you: `CONFLICT_RESOLVER.md`.

---

## 5. Resume Protocol

If resuming a session mid-story, follow `DEVELOPMENT_LOOP.md` Section 2 exactly. The short version:

1. Run `bd prime` — shows the in-progress task immediately.
2. Run `bd ready` — confirms which stories are unblocked.
3. Read `DEVELOPMENT_LOOP.md` — the full resume procedure is in Section 2.
4. Read `PROGRESS.md` — find the story marked 🟡 In Progress, or the last ⬜ story.
5. Cross-check with `CLAUDE.md` Section 5. If they disagree, PROGRESS.md is authoritative.
6. Run `pnpm type-check` and `pnpm test` to confirm the codebase state is clean.
7. Open the active story file. Start from the first unchecked ⬜ task.

---

## 6. Epics & Stories Roadmap

The authoritative implementation sequence is:
stories/epics.md          ← all epics, scope, PRD mapping
stories/EPIC-01-foundation/STORY-001.md  ← start here (Phase 0)
stories/EPIC-01-foundation/STORY-002.md
stories/EPIC-01-foundation/STORY-003.md
stories/EPIC-01-foundation/STORY-004.md
[continue sequentially through EPIC-10]

Never skip stories. Never start a story whose dependencies are not ✅ in PROGRESS.md.
The complete phase-to-phase dependency map is in `docs/architecture/05-build-order.md`.
