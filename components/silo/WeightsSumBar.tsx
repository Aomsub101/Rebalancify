import React from 'react'
import { WeightsSumWarning } from '@/components/silo/WeightsSumWarning'
import { formatNumber } from '@/lib/formatNumber'

function segmentWidth(pct: number): React.CSSProperties {
  return { width: `${Math.max(0, pct)}%` }
}

interface HoldingSlice {
  ticker: string
  current_weight_pct: number
}

interface Props {
  holdings: HoldingSlice[]
  /** Live sum of target weights driven by local state in SiloDetailView (AC5). */
  weightsSumPct: number
}

export function WeightsSumBar({ holdings, weightsSumPct }: Props) {
  const cashTargetPct = Math.max(0, 100 - weightsSumPct)
  const isOverWeight = holdings.length > 0 && weightsSumPct > 100.001
  const sumWarning = holdings.length > 0 && Math.abs(weightsSumPct - 100) > 0.001

  return (
    <div className="space-y-2">
      {/* Current weight distribution bar */}
      <div className="flex h-2 w-full rounded-full overflow-hidden bg-secondary">
        {holdings.map((h) => (
          <div
            key={h.ticker}
            className="h-full bg-primary opacity-80"
            style={segmentWidth(h.current_weight_pct)}
            title={`${h.ticker}: ${formatNumber(h.current_weight_pct, 'weight')}`}
          />
        ))}
      </div>
      {/* AC6 — WeightsSumWarning with exact substituted text */}
      {sumWarning && (
        <WeightsSumWarning
          weightsSumPct={weightsSumPct}
          cashTargetPct={cashTargetPct}
          variant={isOverWeight ? 'over' : 'under'}
        />
      )}
    </div>
  )
}
