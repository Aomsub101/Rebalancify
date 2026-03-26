# STORY-031 — RAG Document Ingest Pipeline (v2.0)

## AGENT CONTEXT

**What this file is:** A user story specification for the RAG document ingest pipeline — default knowledge files, semantic chunking, embedding via user's LLM provider, and optional user PDF/MD upload. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F3-R3 (knowledge base ingest), F3-R4 (user document upload)
**Connected to:** `docs/architecture/02-database-schema.md` (knowledge_chunks table with HNSW index), `docs/architecture/03-api-contract.md` (ingest and upload endpoints), `docs/prd/features/F3-ai-research-hub.md`
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-09 — AI Research Hub
**Phase:** 8
**Estimate:** 3 developer-days (maximum per-story limit reached — this story must be split before implementation begins; see splitting guidance added to Notes section below)
**Status:** 🔲 Not started
**Depends on:** STORY-030 (LLM key stored), STORY-001 (knowledge_chunks table migrated)
**Blocks:** STORY-032

---

## User Story

As a user, my Research Hub is backed by a curated set of default financial literature summaries, and I can optionally upload additional documents to expand my personal knowledge base.

---

## Acceptance Criteria

1. `/knowledge` directory at repo root contains at least 10 default `.md` files covering foundational financial topics (e.g., MPT, risk factors, asset allocation principles, DCF analysis).
2. On first Research Hub use (or via a manual "Rebuild knowledge base" button in Settings), default documents are automatically ingested for the user.
3. Ingest pipeline: read file content → semantic chunk (split at similarity drops) → embed using user's configured LLM provider's embedding endpoint → upsert into `knowledge_chunks` with `user_id`, `document_id`, `chunk_index`, `content`, `embedding`, `metadata`.
4. `metadata` JSONB includes: `{ source: "default" | "upload", title: string, document_name: string }`.
5. HNSW index on `knowledge_chunks.embedding` is used for all retrieval queries (verified via `EXPLAIN ANALYZE`).
6. User can upload a PDF or Markdown file via the Research page. File is processed through the same ingest pipeline with `source: "upload"`.
7. Total corpus size warning: when `knowledge_chunks` storage approaches 400 MB (80% of 500 MB budget), Settings shows: "Your knowledge base is near capacity (80%). Consider removing uploaded documents."
8. Security: embedding API calls are proxied through a Next.js API route — user's LLM key is never in browser network requests.
9. RLS: `knowledge_chunks` rows are only readable by the owning user.

---

## Tasks

- [ ] Write 10+ default `.md` knowledge files in `/knowledge`
- [ ] Write `app/api/knowledge/ingest/route.ts` (chunk + embed + upsert)
- [ ] Write semantic chunking utility in `lib/ragIngest.ts`
- [ ] Add provider-aware embedding call routing (same 6-provider routing as LLM calls)
- [ ] Write `app/api/knowledge/upload/route.ts` (accept PDF/MD, run through ingest)
- [ ] Corpus size check: query `pg_total_relation_size('knowledge_chunks')` → warn in Settings
- [ ] Test: verify HNSW index used via `EXPLAIN ANALYZE` on a similarity query
- [ ] Security test: embedding call goes through `/api/` route, not directly to provider
- [ ] RLS test: user B cannot query user A's `knowledge_chunks`

---

## Default Knowledge Files (minimum set)

```
/knowledge/
├── 01-modern-portfolio-theory.md
├── 02-asset-allocation-principles.md
├── 03-rebalancing-strategies.md
├── 04-systematic-risk-factors.md
├── 05-dcf-analysis-fundamentals.md
├── 06-fixed-income-basics.md
├── 07-crypto-asset-characteristics.md
├── 08-emerging-markets-risk.md
├── 09-behavioral-finance-biases.md
└── 10-portfolio-concentration-risk.md
```

---

## Definition of Done

- [ ] All 9 acceptance criteria verified
- [ ] 10 default knowledge files committed to `/knowledge`
- [ ] HNSW index verified via EXPLAIN ANALYZE
- [ ] Security test documented
- [ ] Corpus size warning tested (mock storage size near 400MB)
- [ ] `bd close <task-id> "STORY-031 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file

---

- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file

---

## Notes

This story exceeds the 3-developer-day maximum and must be split into two stories before implementation:

- **STORY-031a:** Default knowledge base — write 10 `.md` files to `/knowledge/`, write ingest API route, semantic chunker, embedding call routing, upsert to `knowledge_chunks`
- **STORY-031b:** User document upload — upload endpoint, PDF parsing, corpus size monitoring and warning, HNSW index verification

Create `STORY-031b.md` as a sibling file in `EPIC-09-ai-research-hub/` before starting STORY-031a. Add both to `stories/epics.md` and `PROGRESS.md`.
