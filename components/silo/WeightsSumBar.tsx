import { AlertCircle } from 'lucide-react'
import { formatNumber } from '@/lib/formatNumber'

interface HoldingSlice {
  ticker: string
  current_weight_pct: number
  target_weight_pct: number
}

interface Props {
  holdings: HoldingSlice[]
}

export function WeightsSumBar({ holdings }: Props) {
  const weightsSumPct = holdings.reduce((sum, h) => sum + h.target_weight_pct, 0)
  const sumWarning = Math.abs(weightsSumPct - 100) > 0.001 && holdings.length > 0
  const cashTargetPct = Math.max(0, 100 - weightsSumPct)

  return (
    <div className="space-y-2">
      {/* Current weight distribution bar */}
      <div className="flex h-2 w-full rounded-full overflow-hidden bg-secondary">
        {holdings.map((h) => (
          <div
            key={h.ticker}
            className="h-full bg-primary opacity-80"
            style={{ width: `${Math.max(0, h.current_weight_pct)}%` }}
            title={`${h.ticker}: ${formatNumber(h.current_weight_pct, 'weight')}`}
          />
        ))}
      </div>
      {/* Warning when target weights don't sum to 100 */}
      {sumWarning ? (
        <p className="flex items-center gap-1 text-xs text-warning">
          <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
          Target weights sum to {formatNumber(weightsSumPct, 'weight')}. Remaining {formatNumber(cashTargetPct, 'weight')} held as cash.
        </p>
      ) : null}
    </div>
  )
}
