/**
 * Types for portfolio simulation (EPIC-11 — STORY-042, STORY-043)
 * Shape matches POST /api/optimize response (F11-R14)
 */

export interface SimulationStrategy {
  weights: Record<string, number> // e.g. { AAPL: 0.4, TSLA: 0.6 }
  return_3m: string // e.g. "2.34%"
  range: string // e.g. "2.34% ± 1.20%"
}

export interface SimulationStrategies {
  not_to_lose: SimulationStrategy
  expected: SimulationStrategy
  optimistic: SimulationStrategy
}

export interface SimulationMetadata {
  is_truncated_below_3_years: boolean
  limiting_ticker: string
  lookback_months: number
}

export interface SimulationResult {
  strategies: SimulationStrategies
  metadata: SimulationMetadata
}
