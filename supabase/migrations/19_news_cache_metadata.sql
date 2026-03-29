-- Migration 19: Add metadata JSONB column to news_cache
-- Required for STORY-022 Tier-2 enrichment tag matching.
-- Schema: { sector: string, related_tickers: string[], related_terms: string[], personnel: string[] }
-- Rows inserted before this migration will have metadata = NULL (no tier-2 match until re-enriched).

ALTER TABLE news_cache ADD COLUMN IF NOT EXISTS metadata JSONB;
