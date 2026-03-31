'use client'

import { Button } from '@/components/ui/button'

interface Props {
  strategy: 'not_to_lose' | 'expected' | 'optimistic'
  weights: Record<string, number>
  return_3m: string
  range: string
  onApply: (event?: React.MouseEvent) => void
}

const STRATEGY_LABELS: Record<Props['strategy'], string> = {
  not_to_lose: 'Not to Lose',
  expected: 'Expected',
  optimistic: 'Optimistic',
}

/**
 * StrategyCard — renders one simulation strategy row.
 * Columns: strategy name | weights | return/range | Apply Weights button
 * F11-R10 (Results Table), F11-R11 (Apply Weights)
 */
export function StrategyCard({ strategy, weights, return_3m, range, onApply }: Props) {
  const weightsStr = Object.entries(weights)
    .map(([ticker, w]) => `${ticker}: ${(w * 100).toFixed(1)}%`)
    .join(', ')

  return (
    <div className="flex items-center gap-4 rounded-md border border-border bg-card px-4 py-3 text-sm">
      {/* Strategy name */}
      <span className="w-28 shrink-0 font-medium text-foreground">
        {STRATEGY_LABELS[strategy]}
      </span>

      {/* Weights */}
      <span className="w-48 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
        {weightsStr}
      </span>

      {/* Return */}
      <span className="w-24 shrink-0 text-right font-mono text-xs tabular-nums">
        {return_3m}
      </span>

      {/* Range */}
      <span className="w-36 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
        {range}
      </span>

      {/* Apply Weights button */}
      <div className="ml-auto shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={onApply}
          className="text-xs"
        >
          Apply Weights
        </Button>
      </div>
    </div>
  )
}
