# TS.3.1 — Execute Route

## Task
Implement POST /api/silos/:id/rebalance/execute — submit orders to Alpaca, store results.

## Target
`app/api/silos/[id]/rebalance/execute/route.ts`

## Inputs
- Sprint 1 outputs (encryption, Alpaca credentials)
- Sprint 2 outputs (calculate route creates pending sessions)
- `docs/architecture/components/03_rebalancing_engine/04-execute_route.md`

## Process
1. Create `app/api/silos/[id]/rebalance/execute/route.ts`:
   - Input: `{ session_id, approved_order_ids: string[] }` (orders not in list are skipped)
   - Validate: session exists, status = 'pending', owned by user
   - **For Alpaca silos:**
     - Decrypt Alpaca credentials
     - For each approved order: submit market order to Alpaca API
     - Store `alpaca_order_id` on success
     - Update order `execution_status`: 'executed' | 'failed' | 'skipped'
   - **For non-Alpaca silos:**
     - Mark orders as `execution_status: 'manual'`
     - Generate manual instruction text
   - Update session:
     - `status`: 'approved' (all success) | 'partial' (mixed) | 'cancelled' (all skipped)
     - `snapshot_after`: post-execution portfolio state
   - If `approved_order_ids` is empty → status = 'cancelled'
2. These are the ONLY permitted updates on rebalance_sessions

## Outputs
- `app/api/silos/[id]/rebalance/execute/route.ts`

## Verify
- Alpaca orders submitted with correct quantities
- Order statuses recorded accurately
- Session status follows state machine rules
- No other fields on rebalance_sessions modified

## Handoff
→ TS.3.2 (Manual execution)
