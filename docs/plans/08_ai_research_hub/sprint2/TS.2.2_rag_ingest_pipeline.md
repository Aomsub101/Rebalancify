# TS.2.2 — RAG Ingest Pipeline

## Task
Implement semantic chunking → embedding → upsert into knowledge_chunks with HNSW index.

## Target
`lib/ragPipeline.ts`

## Inputs
- `docs/architecture/components/08_ai_research_hub/04_rag_ingest_pipeline.md`

## Process
1. Create `lib/ragPipeline.ts`:
   - `ingestDocument(supabase, userId, documentContent, metadata)`:
     1. Semantic chunking — split at similarity drops (not fixed character counts)
     2. Generate embeddings using user's configured provider:
        - Google: `text-embedding-004`
        - OpenAI: `text-embedding-3-small`
        - Other providers: fall back to provider's embedding endpoint
     3. Upsert into `knowledge_chunks` with: user_id, document_id, chunk_index, content, embedding (vector), metadata
2. Embedding dimension: 1536 (matches OpenAI + Google embedding models)
3. HNSW index on `embedding` column verified via `EXPLAIN ANALYZE`
4. Chunk metadata: `{ source: "default"|"upload", title, document_name }`

## Outputs
- `lib/ragPipeline.ts`

## Verify
- Documents chunked semantically (not fixed-size)
- Embeddings stored correctly in vector column
- HNSW index used in similarity queries (EXPLAIN ANALYZE)

## Handoff
→ TS.2.3 (Knowledge upload)
