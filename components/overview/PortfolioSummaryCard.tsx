/**
 * PortfolioSummaryCard
 * AC-1: Shows total portfolio value across all active silos,
 *        active silo count [X/5], and total unique asset count.
 */
import { TrendingUp, PieChart, BarChart2 } from 'lucide-react'
import type { DriftAsset } from '@/lib/types/portfolio'

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
  /** Map of base_currency to rate_to_usd (number). */
  fxRates: Record<string, number>
  targetCurrency: string
}

function convertAmount(
  amount: number,
  sourceCurrency: string,
  targetCurrency: string,
  fxRates: Record<string, number>,
): number {
  if (!Number.isFinite(amount)) return 0

  const normalizedSource = sourceCurrency.toUpperCase()
  const normalizedTarget = targetCurrency.toUpperCase()

  if (normalizedSource === normalizedTarget) {
    return amount
  }

  const sourceRate = fxRates[normalizedSource] ?? (normalizedSource === 'USD' ? 1 : undefined)
  const targetRate = fxRates[normalizedTarget] ?? (normalizedTarget === 'USD' ? 1 : undefined)

  if (sourceRate === undefined || targetRate === undefined || targetRate === 0) {
    return 0
  }

  return (amount * sourceRate) / targetRate
}

export function PortfolioSummaryCard({
  silos,
  allDriftAssets,
  showUSD,
  fxRates,
  targetCurrency,
}: Props) {
  // Normalize every silo into one display currency before summing.
  const totalValue = silos.reduce((sum, silo) => {
    const rawValue = parseFloat(silo.total_value)
    if (!Number.isFinite(rawValue)) return sum
    return sum + convertAmount(rawValue, silo.base_currency, targetCurrency, fxRates)
  }, 0)

  const displayCurrency = targetCurrency
  const activeSiloCount = silos[0]?.active_silo_count ?? silos.length
  const siloLimit = silos[0]?.silo_limit ?? 5

  // Unique assets: count distinct asset_ids across all drift responses
  const uniqueAssetCount = new Set(allDriftAssets.map((asset) => asset.asset_id)).size

  const isEmpty = totalValue === 0
  const showsConvertedTotal = !isEmpty && silos.some((silo) => silo.base_currency !== displayCurrency)

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
            ? '-'
            : `${displayCurrency} ${totalValue.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
        </p>
        {showsConvertedTotal && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {showUSD ? 'Converted to USD' : `Converted to ${displayCurrency}`}
          </p>
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
