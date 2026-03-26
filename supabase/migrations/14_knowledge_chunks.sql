-- Migration 14: knowledge_chunks table + HNSW index + RLS (v2.0 — migrated in Phase 0)
-- PRE-FLIGHT: run `SELECT extname FROM pg_extension WHERE extname = 'vector';`
-- The 'vector' extension MUST be enabled before running this migration.
-- If missing: Supabase Dashboard → Database → Extensions → enable 'vector'.
--
-- Stores RAG document chunks with 1536-dimension embeddings (OpenAI/Google compatible).
-- HNSW index with cosine distance for sub-100ms nearest-neighbour retrieval.
-- This table will be unused until Phase 8 (STORY-031).

CREATE TABLE knowledge_chunks (
  id           UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id  UUID     NOT NULL,
  chunk_index  INTEGER  NOT NULL,
  content      TEXT     NOT NULL,
  embedding    vector(1536),
  -- Dimension matches OpenAI text-embedding-3-small and Google text-embedding-004
  metadata     JSONB,
  -- Schema: { source: string, title: string, page: int, author: string, document_name: string }
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX knowledge_chunks_embedding_idx ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops);

ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY knowledge_chunks_owner ON knowledge_chunks
  USING (user_id = auth.uid());
