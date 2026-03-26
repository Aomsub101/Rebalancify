-- Migration 11: rebalance_orders table + RLS
-- One row per computed order within a rebalance session.
-- execution_status tracks the order lifecycle from calculation through execution.
-- Broker order ID columns are nullable — populated only when executed on that platform.

CREATE TABLE rebalance_orders (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID          NOT NULL REFERENCES rebalance_sessions(id),
  asset_id            UUID          NOT NULL REFERENCES assets(id),
  order_type          TEXT          NOT NULL,
  -- Allowed values: 'buy' | 'sell'
  quantity            NUMERIC(20,8) NOT NULL,
  estimated_value     NUMERIC(20,8) NOT NULL,
  price_at_calc       NUMERIC(20,8) NOT NULL,
  weight_before_pct   NUMERIC(6,3)  NOT NULL,
  weight_after_pct    NUMERIC(6,3)  NOT NULL,
  execution_status    TEXT          NOT NULL DEFAULT 'pending',
  -- Allowed values: 'pending' | 'skipped' | 'executed' | 'failed' | 'manual'
  -- 'pending'  = calculated, not yet submitted to the user for approval
  -- 'skipped'  = user checked the skip box in Step 2 of the wizard
  -- 'executed' = submitted to Alpaca and confirmed (v1.0 Alpaca only)
  -- 'failed'   = submitted to Alpaca but Alpaca returned an error
  -- 'manual'   = user must execute on their platform (all non-Alpaca silos in v1.0)
  alpaca_order_id     TEXT,         -- Populated when executed via Alpaca (v1.0)
  bitkub_order_id     TEXT,         -- Populated when executed via BITKUB (v2.0)
  innovestx_order_id  TEXT,         -- Populated when executed via InnovestX (v2.0)
  schwab_order_id     TEXT,         -- Populated when executed via Schwab (v2.0)
  webull_order_id     TEXT,         -- Populated when executed via Webull (v2.0)
  executed_at         TIMESTAMPTZ
);

ALTER TABLE rebalance_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY rebal_orders_owner ON rebalance_orders
  USING (session_id IN (
    SELECT id FROM rebalance_sessions WHERE user_id = auth.uid()
  ));
