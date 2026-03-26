# stories/ — Story Framework

## AGENT CONTEXT

**What this file is:** An orientation guide for the stories directory. Explains the framework, file naming, and how stories relate to epics and the build order.
**Derived from:** TECH_DOCS_v1.2.md (DOC-05 Build Order), PRD_v1.3.md
**Connected to:** stories/epics.md, stories/STORY-TEMPLATE.md, docs/architecture/05-build-order.md, PROGRESS.md
**Critical rules for agents using this file:**
- Never implement a story whose dependencies are not marked complete in PROGRESS.md.
- Every story must use STORY-TEMPLATE.md as the base — no improvised formats.
- **EPIC-01 format exception:** Stories in `EPIC-01-foundation/` (STORY-001 through STORY-004) were written before `STORY-TEMPLATE.md` was finalised. They use an earlier format (`**Epic:**`, `**Estimate: M/L**`, `Acceptance Criteria`, `Tasks` headings) that predates the template. They are not bugs. From EPIC-02 onward, all stories must strictly follow `STORY-TEMPLATE.md`. Do not reformat EPIC-01 stories — they are complete specifications.

---

## Directory Structure

```
stories/
├── README.md                ← This file
├── epics.md                 ← All epic definitions and status
├── STORY-TEMPLATE.md        ← Canonical template for all stories
│
├── EPIC-01-foundation/      ← Phase 0 of build order
├── EPIC-02-silos-holdings/  ← Phase 1
├── EPIC-03-alpaca-integration/  ← Phase 2
├── EPIC-04-broker-fetch/    ← Phase 3
├── EPIC-05-drift-overview/  ← Phase 4
├── EPIC-06-news/            ← Phase 5
├── EPIC-07-discovery/       ← Phase 6
├── EPIC-08-pwa-polish/      ← Phase 7
├── EPIC-09-ai-research-hub/ ← Phase 8 (v2.0)
└── EPIC-10-multi-platform-execution/ ← Phase 9 (v2.0) — story files deferred until Phase 8 is 80% complete
```

---

## Story Lifecycle

```
Planned → In Progress → In Review → Complete
```

A story is **Planned** when it exists in this directory but no code has been written.
A story is **In Progress** when active development has started.
A story is **In Review** when all acceptance criteria pass locally but PROGRESS.md is not yet updated.
A story is **Complete** when all Definition of Done items are checked and PROGRESS.md is updated.

---

## Effort Estimation

Stories are estimated in developer-days. A developer-day is 6 hours of focused coding including testing. Stories exceeding 3 developer-days must be split.

| Estimate | Meaning |
|---|---|
| 0.5 | Half a day — config, migrations, simple CRUD |
| 1 | One full focused day |
| 2 | Two days — includes non-trivial business logic |
| 3 | Three days — maximum for a single story |

---

## Story File Rules

These two rules are absolute. Violating either creates a documentation bug that will mislead any agent or developer reading the stories directory.

**Rule: One story per file.**
Each file in any `EPIC-*/` directory must contain exactly one story. The filename must be `STORY-[NNN].md` where NNN is the story number. Multi-story files (e.g., `STORY-014-016.md`) are never permitted. If you find one, split it immediately.

**Rule: No story content overlap.**
A story's content must exist in exactly one file. Run `grep -rn "^# STORY-[NNN]"` stories/ before creating any story file to confirm the story number is not already present elsewhere. If a story number exists in two places, delete the duplicate — keep only the file in its correct EPIC directory.

---

## Dependency Rule

No story may begin until all stories listed in its `## Dependencies` section are marked ✅ in PROGRESS.md. This is enforced by the agent — not just a suggestion.

---

## Acceptance Criteria Format

Acceptance criteria use plain numbered assertions:

```
1. Given [context], when [action], then [expected outcome].
2. [Assertion that is independently testable.]
```

Given/When/Then phrasing is recommended but not required. Each criterion must be independently testable. IDs like `AC-001` are not required for existing or new stories.

---

## How to Create a New Story

1. Copy `STORY-TEMPLATE.md` into the appropriate EPIC folder.
2. Rename it `STORY-[NNN].md` using the next sequential number. One file = one story, always. Do not add a second story to an existing file.
3. Fill in every section — no section may be left blank except Notes.
4. Add the story to `stories/epics.md`.
5. Add the story to `PROGRESS.md`.
6. Follow the New Feature Checklist in the template if this story is for a post-v2.0 feature.
