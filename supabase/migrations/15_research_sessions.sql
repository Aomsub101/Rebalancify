-- Migration 15: research_sessions table + RLS (v2.0 — migrated in Phase 0)
-- Stores AI Research Hub outputs. One row per research query.
-- asset_id is nullable — research can be triggered for tickers not yet in the assets registry.
-- This table will be unused until Phase 8 (STORY-032).

CREATE TABLE research_sessions (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker        TEXT    NOT NULL,
  asset_id      UUID    REFERENCES assets(id),
  llm_provider  TEXT    NOT NULL,
  llm_model     TEXT    NOT NULL,
  output        JSONB   NOT NULL,
  -- Schema: { sentiment: string, confidence: float, risk_factors: string[], summary: string, sources: string[] }
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  refreshed_at  TIMESTAMPTZ,
  metadata      JSONB
  -- Schema: { source: 'manual_search' | 'portfolio_holding', trigger_page: string }
);

ALTER TABLE research_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY research_sessions_owner ON research_sessions
  USING (user_id = auth.uid());
