/**
 * Type definitions for the rebalance calculate and execute API responses.
 * Consumed by the RebalanceWizardView and its child panels.
 */

export interface RebalanceOrder {
  id: string
  asset_id: string
  ticker: string
  order_type: 'buy' | 'sell'
  quantity: string
  estimated_value: string
  price_at_calc: string
  weight_before_pct: number
  weight_after_pct: number
}

export interface CalculateResponse {
  session_id: string | null
  mode: 'partial' | 'full'
  balance_valid: boolean
  balance_errors: string[]
  weights_sum_pct: number
  cash_target_pct: number
  snapshot_before: Record<string, unknown>
  orders: RebalanceOrder[]
}

export interface ExecuteOrderResult {
  id: string
  execution_status: 'executed' | 'skipped' | 'failed' | 'manual'
  alpaca_order_id?: string
}

export interface ExecuteResponse {
  session_id: string
  executed_count: number
  skipped_count: number
  failed_count: number
  orders: ExecuteOrderResult[]
}
