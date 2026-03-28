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
            title={`${h.ticker}: ${h.current_weight_pct.toFixed(2)}%`}
          />
        ))}
      </div>
      {/* Warning when target weights don't sum to 100 */}
      {sumWarning ? (
        <p className="text-xs text-warning">
          Target weights sum to {weightsSumPct.toFixed(1)}%. Remaining {cashTargetPct.toFixed(1)}% held as cash.
        </p>
      ) : null}
    </div>
  )
}
