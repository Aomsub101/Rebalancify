import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorBanner } from '@/components/shared/ErrorBanner'
import { formatNumber } from '@/lib/formatNumber'
import { TopMoverItem } from '@/lib/topMoversService'

export type { TopMoverItem }

interface Props {
  gainers: TopMoverItem[]
  losers: TopMoverItem[]
  stale: boolean
  isLoading: boolean
  isError: boolean
}

function MoverRow({
  item,
  variant,
}: {
  item: TopMoverItem
  variant: 'gainer' | 'loser'
}) {
  const isGainer = variant === 'gainer'
  const changeLabel = formatNumber(item.change_pct, 'drift')
  const priceLabel = formatNumber(item.price, 'price', 'USD')

  return (
    <div className="flex items-center justify-between py-2 border-t border-border first:border-t-0">
      <div className="min-w-0 flex-1">
        <span className="text-sm font-mono font-medium text-foreground tabular-nums">
          {item.ticker}
        </span>
        <span className="ml-2 text-xs text-muted-foreground truncate hidden sm:inline">
          {item.name}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <span
          className="text-sm font-mono tabular-nums text-right text-muted-foreground"
          aria-label={`Price: ${priceLabel}`}
        >
          {priceLabel}
        </span>
        <span
          className={[
            'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono tabular-nums',
            isGainer
              ? 'bg-positive-bg text-positive'
              : 'bg-negative-bg text-negative',
          ].join(' ')}
          aria-label={`Change: ${changeLabel}`}
        >
          {isGainer ? (
            <TrendingUp className="h-3 w-3 shrink-0" aria-hidden="true" />
          ) : (
            <TrendingDown className="h-3 w-3 shrink-0" aria-hidden="true" />
          )}
          {changeLabel}
        </span>
      </div>
    </div>
  )
}

export function TopMoversTable({ gainers, losers, stale, isLoading, isError }: Props) {
  if (isLoading) {
    return <LoadingSkeleton rows={5} />
  }

  if (isError) {
    return <ErrorBanner message="Failed to load market movers. Please try again." />
  }

  if (gainers.length === 0 && losers.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No market data available"
        description="Market mover data is currently unavailable. Please check back later."
      />
    )
  }

  return (
    <div className="space-y-2">
      {/* Stale data notice — secondary non-colour signal (AlertTriangle icon) */}
      {stale && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-md bg-warning-bg text-warning text-xs"
          role="status"
          aria-live="polite"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Market data may be delayed — live sources temporarily unavailable.</span>
        </div>
      )}

      {/* Two-column layout: Gainers | Losers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Gainers column */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-positive" aria-hidden="true" />
            Top Gainers
          </h3>
          {gainers.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No gainer data</p>
          ) : (
            <div>
              {gainers.map((item) => (
                <MoverRow key={item.ticker} item={item} variant="gainer" />
              ))}
            </div>
          )}
        </div>

        {/* Losers column */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <TrendingDown className="h-3.5 w-3.5 text-negative" aria-hidden="true" />
            Top Losers
          </h3>
          {losers.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No loser data</p>
          ) : (
            <div>
              {losers.map((item) => (
                <MoverRow key={item.ticker} item={item} variant="loser" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
