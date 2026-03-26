# PROJECT_LOG.md — Rebalancify Implementation History

## AGENT CONTEXT

**What this file is:** A living implementation history log — one entry per completed story. Agents scan the last 3–5 entries at the start of every session to understand recent decisions, discovered issues, and carry-over notes.
**Derived from:** BMAD-inspired project logging practice
**Connected to:** PROGRESS.md (status tracker), CLAUDE.md (master rules), all STORY-*.md files
**Critical rules for agents using this file:**
- Add a new entry at the TOP of the Completed Stories section every time a story is marked complete.
- Never edit past entries — they are append-only history.
- Keep each entry concise: ~10–15 lines. Expand only if there is a critical discovery.
- Scan the last 3–5 entries before starting any new story.

---

## Entry Template

Copy this block to the top of the Completed Stories section when closing a story:

```
### STORY-[NNN] — [Title]
**Completed:** YYYY-MM-DD
**Effort:** [actual vs estimated — e.g., "1 day (estimated 1)"]

**What was built:**
- [Bullet: key file or feature delivered]
- [Bullet: key file or feature delivered]

**Decisions made:**
- [Decision + reason — e.g., "Used X instead of Y because Z"]

**Discovered issues / carry-over notes:**
- [Issue or note that future stories must know — e.g., "Supabase free tier does not support X; workaround in lib/Y.ts"]

**Quality gates passed:** type-check ✅ | test ✅ | build ✅ | RLS ✅
```

---

## Completed Stories

### STORY-001 — Supabase Setup & All Migrations
**Completed:** 2026-03-26
**Effort:** 1 day (estimated M / 3–5 days — migration-only story ran faster than estimated)

**What was built:**
- `supabase/migrations/` with 18 SQL files covering all tables, RLS policies, indexes, views, and pg_cron jobs
- Minimal toolchain: `tsconfig.json` (scoped include/exclude), `vitest.config.ts` (passWithNoTests, excludes Playwright tests), `package.json` updated with typescript + vitest + @vitest/coverage-v8
- Updated `.gitignore` to exclude `.env`, `coverage/`, `tsconfig.tsbuildinfo`, `.claude/`, `package-lock.json`

**Decisions made:**
- `pnpm build` stubbed as echo for STORY-001 (no Next.js installed); STORY-002 will replace with `next build`
- `vitest.config.ts` uses `passWithNoTests: true` — unit tests begin in STORY-002 with first `lib/` files
- `tsconfig.json` uses explicit `"include": ["**/*.ts", "**/*.tsx"]` + `"exclude": ["node_modules", ".beads", "supabase", ...]` to avoid scanning non-app directories
- migration 17 inserts in-app notifications only (ADR-013) — email via Vercel Cron in STORY-020

**Discovered issues / carry-over notes:**
- pnpm was not installed globally; installed via `npm install -g pnpm` before first `pnpm install`
- `bd dolt push` fails — Dolt remote not configured (non-blocking; beads state is local only until remote is set up)
- STORY-002 must overwrite `package.json` `build`/`dev`/`start`/`lint` scripts when scaffolding Next.js

**Quality gates passed:** type-check ✅ | test ✅ | build ✅ (stub) | RLS ✅ | auth trigger ✅ | RLS isolation ✅

---

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | Gate passed |
| ❌ | Gate failed — see story notes |
| ⚠️ | Passed with known caveat |
