# STORY-031b — RAG User Document Upload & Corpus Management

## AGENT CONTEXT

**What this file is:** A user story specification for the user document upload endpoint (PDF/MD), corpus size monitoring, and HNSW index verification. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F3-R4 (user document upload), F3-R3 (corpus size warning)
**Connected to:** `docs/architecture/02-database-schema.md` (knowledge_chunks table, HNSW index), `docs/architecture/03-api-contract.md` (upload endpoint), `lib/ragIngest.ts` (created in STORY-031)
**Critical rules for agents using this file:**
- Do not start implementation until STORY-031 is marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-09 — AI Research Hub
**Phase:** 8
**Estimate:** 2 developer-days
**Status:** 🔲 Not started
**Depends on:** STORY-031 (default knowledge base + ingest pipeline)
**Blocks:** STORY-032

---

## User Story

As a user, I can upload additional PDF or Markdown documents to expand my personal knowledge base, and I am warned when storage approaches capacity.

---

## Acceptance Criteria

1. `POST /api/knowledge/upload` accepts a PDF or Markdown file. File is processed through the same ingest pipeline (from STORY-031) with `source: "upload"`.
2. `metadata` JSONB includes `{ source: "upload", title: string, document_name: string }`.
3. Total corpus size warning: when `knowledge_chunks` storage approaches 400 MB (80% of 500 MB budget), Settings shows: "Your knowledge base is near capacity (80%). Consider removing uploaded documents."
4. HNSW index on `knowledge_chunks.embedding` is used for all retrieval queries. Verified via `EXPLAIN ANALYZE`.
5. Security: embedding API calls proxied through Next.js API route — user's LLM key never in browser network requests.
6. RLS: `knowledge_chunks` rows only readable by the owning user.

---

## Tasks

- [ ] Write `app/api/knowledge/upload/route.ts` (accept PDF/MD, parse, run through ingest)
- [ ] Corpus size check: query `pg_total_relation_size('knowledge_chunks')` → warn in Settings
- [ ] Test: verify HNSW index used via `EXPLAIN ANALYZE` on a similarity query
- [ ] Security test: embedding call goes through `/api/` route
- [ ] RLS test: user B cannot query user A's `knowledge_chunks`

---

## Definition of Done

- [ ] All 6 acceptance criteria verified
- [ ] HNSW index verified via EXPLAIN ANALYZE
- [ ] Security test documented
- [ ] Corpus size warning tested (mock storage size near 400MB)
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] `bd close <task-id> "STORY-031b complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
