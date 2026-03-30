-- Migration 20: RPC for corpus size calculation

CREATE OR REPLACE FUNCTION get_corpus_size()
RETURNS bigint AS $$
BEGIN
  RETURN pg_total_relation_size('knowledge_chunks');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
