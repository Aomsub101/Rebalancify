-- Migration 02: user_profiles table
-- One row per authenticated user. Created automatically by on_auth_user_created trigger.
-- Stores display preferences, encrypted broker credentials, and LLM config.
-- IMPORTANT: onboarded and progress_banner_dismissed columns are intentional additions
--            not present in TECH_DOCS_v1_2.md — use this file as authoritative source.

CREATE TABLE user_profiles (
  id                            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name                  TEXT,
  global_currency               CHAR(3)     NOT NULL DEFAULT 'USD',
  show_usd_toggle               BOOLEAN     NOT NULL DEFAULT FALSE,
  drift_notif_channel           TEXT        NOT NULL DEFAULT 'both',
  -- Allowed values: 'app' | 'email' | 'both'

  -- Alpaca
  alpaca_key_enc                TEXT,
  alpaca_secret_enc             TEXT,
  alpaca_mode                   TEXT        NOT NULL DEFAULT 'paper',
  -- Allowed values: 'paper' | 'live'

  -- BITKUB
  bitkub_key_enc                TEXT,
  bitkub_secret_enc             TEXT,

  -- InnovestX — Equity sub-account (Settrade Open API: OAuth Bearer)
  innovestx_key_enc             TEXT,   -- Settrade App ID
  innovestx_secret_enc          TEXT,   -- Settrade App Secret
  -- InnovestX — Digital Asset sub-account (proprietary HMAC-SHA256 API)
  innovestx_digital_key_enc     TEXT,   -- Digital Asset API Key
  innovestx_digital_secret_enc  TEXT,   -- Digital Asset API Secret

  -- Charles Schwab (OAuth — token stored, not key/secret)
  schwab_access_enc             TEXT,
  schwab_refresh_enc            TEXT,
  schwab_token_expires          TIMESTAMPTZ,

  -- Webull
  webull_key_enc                TEXT,
  webull_secret_enc             TEXT,

  -- LLM (v2.0)
  -- provider allowed values: 'openrouter' | 'google' | 'groq' | 'openai' | 'anthropic' | 'deepseek'
  llm_provider                  TEXT,
  llm_key_enc                   TEXT,
  llm_model                     TEXT,

  onboarded                     BOOLEAN     NOT NULL DEFAULT FALSE,
  progress_banner_dismissed     BOOLEAN     NOT NULL DEFAULT FALSE,
  -- TRUE after user explicitly dismisses the post-onboarding progress banner.
  -- Set via PATCH /api/profile. Persists across devices (not localStorage).

  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_profiles_self ON user_profiles
  USING (id = auth.uid());
