/**
 * Shared portfolio types — extracted from components to avoid cross-component import tangles.
 * See DOCS/architecture/refactoring_plan.md § Phase 1a.
 */

/**
 * DriftAsset — represents a single asset's drift state within a silo.
 * Used by: PortfolioSummaryCard, SiloCard, GlobalDriftBanner, overview/page.
 */
export interface DriftAsset {
  asset_id: string
  ticker: string
  drift_pct: number
  drift_state: 'green' | 'yellow' | 'red'
  drift_breached: boolean
}
