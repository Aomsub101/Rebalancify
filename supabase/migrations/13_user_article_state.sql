-- Migration 13: user_article_state table + RLS
-- Tracks per-user read/dismissed state for news articles.
-- Cascades on both user and article delete to avoid orphaned state rows.

CREATE TABLE user_article_state (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id     UUID    NOT NULL REFERENCES news_cache(id) ON DELETE CASCADE,
  is_read        BOOLEAN NOT NULL DEFAULT FALSE,
  is_dismissed   BOOLEAN NOT NULL DEFAULT FALSE,
  interacted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, article_id)
);

ALTER TABLE user_article_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY article_state_owner ON user_article_state
  USING (user_id = auth.uid());
