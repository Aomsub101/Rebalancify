-- Migration 07: target_weights table + constraint + RLS
-- Stores the user-defined target weight percentage for each asset in a silo.
-- weight_pct is NUMERIC(6,3) — three decimal places (e.g. 14.820).
-- Sum across a silo does not need to equal 100; remainder is target cash allocation.
-- weight_range CHECK prevents nonsensical values outside [0, 100].

CREATE TABLE target_weights (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  silo_id     UUID          NOT NULL REFERENCES silos(id) ON DELETE CASCADE,
  asset_id    UUID          NOT NULL REFERENCES assets(id),
  weight_pct  NUMERIC(6,3)  NOT NULL,
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(silo_id, asset_id)
);

ALTER TABLE target_weights ADD CONSTRAINT weight_range
  CHECK (weight_pct >= 0 AND weight_pct <= 100);

ALTER TABLE target_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY target_weights_owner ON target_weights
  USING (silo_id IN (SELECT id FROM silos WHERE user_id = auth.uid()));
