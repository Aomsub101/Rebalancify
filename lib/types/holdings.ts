export interface Holding {
  id: string
  asset_id: string
  ticker: string
  name: string
  asset_type: string
  quantity: string
  cost_basis: string | null
  current_price: string
  current_value: string
  current_weight_pct: number
  target_weight_pct: number
  drift_pct: number
  drift_breached: boolean
  source: string
  stale_days: number
  last_updated_at: string
}

export interface HoldingsResponse {
  drift_threshold: number
  cash_balance: string
  total_value: string
  holdings: Holding[]
}
