-- 22_holdings_acquired_at.sql
-- Add acquired_at column to holdings: records when an asset was first acquired
-- (or re-acquired after a complete sell-out).
-- Age = NOW() - acquired_at.

ALTER TABLE holdings ADD COLUMN acquired_at TIMESTAMPTZ;

-- Backfill: for existing holdings with quantity > 0, set acquired_at = last_updated_at
-- (best approximation: last price sync ≈ acquisition date for existing holdings)
UPDATE holdings
SET acquired_at = last_updated_at
WHERE quantity > 0 AND acquired_at IS NULL;

-- Allow NULL for holdings with 0 quantity (not yet acquired)
-- Then make NOT NULL after backfill (existing rows with qty=0 remain NULL-able)
-- Actually keep NULLable — it means "not yet acquired"
