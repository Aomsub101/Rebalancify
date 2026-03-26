-- Migration 05: asset_mappings table + RLS
-- Maps a user's local label (e.g. "AAPL" on Alpaca) to a canonical asset record.
-- Created once per (silo_id, asset_id) combination — never re-prompted after confirmation.

CREATE TABLE asset_mappings (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  silo_id       UUID    NOT NULL REFERENCES silos(id) ON DELETE CASCADE,
  asset_id      UUID    NOT NULL REFERENCES assets(id),
  local_label   TEXT    NOT NULL,
  confirmed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(silo_id, asset_id)
);

ALTER TABLE asset_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY asset_mappings_owner ON asset_mappings
  USING (silo_id IN (SELECT id FROM silos WHERE user_id = auth.uid()));
