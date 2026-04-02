# TS.2.4 — Knowledge APIs

## Task
Implement knowledge ingest and corpus size monitoring endpoints.

## Target
`app/api/knowledge/`

## Inputs
- TS.2.2 outputs (RAG pipeline)
- `docs/architecture/components/08_ai_research_hub/08_api_knowledge_ingest.md`
- `docs/architecture/components/08_ai_research_hub/10_api_knowledge_corpus_size.md`

## Process
1. **POST /api/knowledge/ingest:** Default knowledge base ingest
   - Read all files from `/knowledge/` directory
   - For each: call `ingestDocument()` with `source: "default"`
   - Idempotent: skip documents already ingested (check by document_name)
   - Triggered on first Research Hub use or via Settings "Rebuild" button
2. **GET /api/knowledge/corpus-size:**
   - Query total storage used by `knowledge_chunks` for current user
   - Return: `{ total_chunks, estimated_size_mb, capacity_pct, capacity_warning }`
   - Warning threshold: 80% of 500 MB budget

## Outputs
- `app/api/knowledge/ingest/route.ts`
- `app/api/knowledge/corpus-size/route.ts`

## Verify
- Default ingest creates chunks for all 10 knowledge files
- Idempotent: second ingest doesn't duplicate
- Corpus size accurately reported

## Handoff
→ Sprint 3 (LLM router + research endpoint)
