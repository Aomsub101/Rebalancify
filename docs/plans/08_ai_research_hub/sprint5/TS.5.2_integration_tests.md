# TS.5.2 — Integration Tests

## Task
Write integration tests for the RAG pipeline and research flow with mocked LLM.

## Target
`tests/integration/`

## Process
1. `tests/integration/rag-ingest.test.ts`:
   - Ingest default knowledge base → chunks created in DB
   - HNSW index used in similarity query (EXPLAIN ANALYZE)
   - Idempotent ingest: second run doesn't duplicate
2. `tests/integration/research-flow.test.ts`:
   - Mock LLM response → structured output parsed → session stored
   - Cache hit → no LLM call
   - Forced refresh → new session row
   - Allocation guard trigger → 422 response
3. `tests/integration/knowledge-upload.test.ts`:
   - Upload MD file → chunks created
   - Upload PDF → text extracted → chunks created
   - Delete document → chunks removed
   - Corpus size accurately reported

## Outputs
- `tests/integration/rag-ingest.test.ts`
- `tests/integration/research-flow.test.ts`
- `tests/integration/knowledge-upload.test.ts`

## Verify
- All integration tests pass
