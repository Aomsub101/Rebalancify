export type DriftState = 'green' | 'yellow' | 'red'

/**
 * Classifies drift into three states based on the per-silo threshold.
 *
 * AC3 (STORY-017):
 *   green  — ABS(drift_pct) <= drift_threshold
 *   yellow — drift_threshold < ABS(drift_pct) <= drift_threshold + 2
 *   red    — ABS(drift_pct) > drift_threshold + 2
 */
export function computeDriftState(driftPct: number, threshold: number): DriftState {
  const abs = Math.abs(driftPct)
  if (abs <= threshold) return 'green'
  if (abs <= threshold + 2) return 'yellow'
  return 'red'
}
