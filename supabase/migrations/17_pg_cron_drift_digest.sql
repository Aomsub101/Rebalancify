-- Migration 17: pg_cron drift digest job
-- PRE-FLIGHT: run `SELECT extname FROM pg_extension WHERE extname = 'pg_cron';`
-- The 'pg_cron' extension MUST be enabled before running this migration.
-- If missing: Supabase Dashboard → Database → Extensions → enable 'pg_cron'.
--
-- Runs daily at 08:00 UTC. For each active silo, computes current asset weights
-- from holdings + price_cache, compares to target_weights, and inserts a
-- 'drift_breach' notification row when drift exceeds the silo's drift_threshold.
--
-- IMPORTANT (ADR-013): This job inserts in-app notifications ONLY.
-- It does NOT call Resend or any external HTTP endpoint.
-- Email delivery is handled separately by the Vercel Cron Job at:
--   app/api/cron/drift-digest/route.ts (scheduled in vercel.json at 08:00 UTC)
--
-- Deduplication: only one unread notification per (user, silo, ticker) per calendar day.

CREATE OR REPLACE FUNCTION check_drift_breaches()
RETURNS void AS $$
DECLARE
  v_silo        RECORD;
  v_holding     RECORD;
  v_total_value NUMERIC(20,8);
  v_cur_weight  NUMERIC(6,3);
  v_tgt_weight  NUMERIC(6,3);
  v_drift       NUMERIC(6,3);
  v_message     TEXT;
BEGIN
  FOR v_silo IN
    SELECT id, user_id, name, drift_threshold
    FROM silos
    WHERE is_active = TRUE
  LOOP
    -- Compute total silo value: sum of (quantity * latest cached price) + cash_balance
    SELECT COALESCE(SUM(h.quantity * p.price), 0) + COALESCE(SUM(h.cash_balance), 0)
    INTO v_total_value
    FROM holdings h
    JOIN price_cache p ON p.asset_id = h.asset_id
    WHERE h.silo_id = v_silo.id;

    CONTINUE WHEN v_total_value = 0;

    FOR v_holding IN
      SELECT
        h.asset_id,
        h.quantity,
        p.price,
        a.ticker,
        COALESCE(tw.weight_pct, 0) AS target_weight_pct
      FROM holdings h
      JOIN price_cache p  ON p.asset_id  = h.asset_id
      JOIN assets     a   ON a.id        = h.asset_id
      LEFT JOIN target_weights tw
        ON tw.silo_id = h.silo_id AND tw.asset_id = h.asset_id
      WHERE h.silo_id = v_silo.id
    LOOP
      v_cur_weight := ROUND(((v_holding.quantity * v_holding.price) / v_total_value) * 100, 3);
      v_tgt_weight := v_holding.target_weight_pct;
      v_drift      := ABS(v_cur_weight - v_tgt_weight);

      IF v_drift > v_silo.drift_threshold THEN
        -- Deduplicate: skip if an unread notification for this (user, silo, ticker)
        -- already exists today.
        IF NOT EXISTS (
          SELECT 1
          FROM notifications
          WHERE user_id     = v_silo.user_id
            AND silo_id     = v_silo.id
            AND asset_ticker = v_holding.ticker
            AND type        = 'drift_breach'
            AND is_read     = FALSE
            AND created_at >= CURRENT_DATE
        ) THEN
          v_message := format(
            'Drift alert: %s in silo "%s" is %.2f%% away from target (current: %.2f%%, target: %.2f%%)',
            v_holding.ticker,
            v_silo.name,
            v_drift,
            v_cur_weight,
            v_tgt_weight
          );

          INSERT INTO notifications (user_id, type, message, silo_id, asset_ticker)
          VALUES (v_silo.user_id, 'drift_breach', v_message, v_silo.id, v_holding.ticker);
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule the job: daily at 08:00 UTC
SELECT cron.schedule(
  'drift-digest-daily',
  '0 8 * * *',
  'SELECT check_drift_breaches()'
);
