-- Verify HNSW index usage for knowledge_chunks
-- Run this in the Supabase SQL Editor.

-- 1. Insert some dummy data if the table is empty
-- INSERT INTO knowledge_chunks (user_id, document_id, chunk_index, content, embedding, metadata)
-- SELECT 
--   auth.uid(), 
--   gen_random_uuid(), 
--   i, 
--   'Dummy content ' || i, 
--   array_fill(0.1, array[1536])::vector, 
--   '{"source": "test"}'::jsonb
-- FROM generate_series(1, 100) s(i);

-- 2. Run EXPLAIN ANALYZE on a similarity search
-- Note: HNSW index is only used when the table has enough rows (usually > 1000 or after VACUUM ANALYZE)
-- and when using the supported operators like <=> (cosine distance).

EXPLAIN ANALYZE
SELECT 
  id, 
  content, 
  metadata,
  1 - (embedding <=> array_fill(0.1, array[1536])::vector) as similarity
FROM knowledge_chunks
ORDER BY embedding <=> array_fill(0.1, array[1536])::vector
LIMIT 5;

-- Expected output should mention "Index Scan using knowledge_chunks_embedding_idx" 
-- if the planner decides it's more efficient than a Seq Scan.
