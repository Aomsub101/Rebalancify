-- Migration 23: Move cash_balance to silos, remove cost_basis/acquired_at from holdings
-- Cash belongs to the silo (account-level), not individual asset holdings.
-- cost_basis and acquired_at are broker-specific metadata not used by the rebalance engine.

-- Step 1: Add cash_balance to silos (must exist before backfill)
ALTER TABLE silos ADD COLUMN IF NOT EXISTS cash_balance NUMERIC(20,8) NOT NULL DEFAULT 0;

-- Step 2: Backfill silos.cash_balance from holdings.cash_balance BEFORE dropping the column
UPDATE silos
SET cash_balance = sub.total
FROM (
  SELECT silo_id, SUM(cash_balance) AS total
  FROM holdings
  WHERE cash_balance > 0
  GROUP BY silo_id
) AS sub
WHERE silos.id = sub.silo_id;

-- Step 3: Add NOT NULL constraint now that backfill is done
ALTER TABLE silos ALTER COLUMN cash_balance SET NOT NULL;

-- Step 4: Remove deprecated columns from holdings
ALTER TABLE holdings DROP COLUMN IF EXISTS cash_balance;
ALTER TABLE holdings DROP COLUMN IF EXISTS cost_basis;
ALTER TABLE holdings DROP COLUMN IF EXISTS acquired_at;
