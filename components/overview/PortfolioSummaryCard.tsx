/**
 * PortfolioSummaryCard
 * AC-1: Shows total portfolio value across all active silos,
 *        active silo count [X/5], and total unique asset count.
 */
import { TrendingUp, PieChart, BarChart2 } from 'lucide-react'

export interface DriftAsset {
  asset_id: string
  ticker: string
  drift_pct: number
  drift_state: 'green' | 'yellow' | 'red'
  drift_breached: boolean
}

export interface SiloForSummary {
  id: string
  total_value: string
  base_currency: string
  active_silo_count: number
  silo_limit: number
}

interface Props {
  silos: SiloForSummary[]
  /** Aggregated drift assets from all silos (for unique asset count). Pass empty array while loading. */
  allDriftAssets: DriftAsset[]
  showUSD: boolean
  /** Map of base_currency → rate_to_usd (number) */
  fxRates: Record<string, number>
}

export function PortfolioSummaryCard({ silos, allDriftAssets, showUSD, fxRates }: Props) {
  // Total portfolio value — sum all silos, optionally convert to USD
  const totalValue = silos.reduce((sum, s) => {
    const val = parseFloat(s.total_value)
    if (!Number.isFinite(val)) return sum
    const rate = showUSD ? (fxRates[s.base_currency] ?? 1) : 1
    return sum + val * rate
  }, 0)

  const displayCurrency = showUSD ? 'USD' : (silos[0]?.base_currency ?? 'USD')

  const activeSiloCount = silos[0]?.active_silo_count ?? silos.length
  const siloLimit = silos[0]?.silo_limit ?? 5

  // Unique assets: count distinct asset_ids across all drift responses
  const uniqueAssetCount = new Set(allDriftAssets.map((a) => a.asset_id)).size

  const isEmpty = totalValue === 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {/* Total portfolio value */}
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-xs text-muted-foreground font-mono uppercase tracking-wide">
            Total Value
          </span>
        </div>
        <p className="text-2xl font-mono font-semibold text-foreground tabular-nums">
          {isEmpty
            ? '—'
            : `${showUSD ? 'USD' : displayCurrency} ${totalValue.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
        </p>
        {showUSD && !isEmpty && (
          <p className="text-xs text-muted-foreground mt-0.5">Converted to USD</p>
        )}
      </div>

      {/* Active silo count */}
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-2">
          <PieChart className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-xs text-muted-foreground font-mono uppercase tracking-wide">
            Active Silos
          </span>
        </div>
        <p className="text-2xl font-mono font-semibold text-foreground tabular-nums">
          {activeSiloCount}
          <span className="text-base text-muted-foreground font-normal">
            &nbsp;/&nbsp;{siloLimit}
          </span>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {siloLimit - activeSiloCount} slot{siloLimit - activeSiloCount === 1 ? '' : 's'} remaining
        </p>
      </div>

      {/* Unique assets */}
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-2">
          <BarChart2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-xs text-muted-foreground font-mono uppercase tracking-wide">
            Unique Assets
          </span>
        </div>
        <p className="text-2xl font-mono font-semibold text-foreground tabular-nums">
          {uniqueAssetCount}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">Across all silos</p>
      </div>
    </div>
  )
}
