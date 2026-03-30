import { AlertCircle } from 'lucide-react'
import { formatNumber } from '@/lib/formatNumber'

interface Props {
  weightsSumPct: number
  cashTargetPct: number
  /** 'over' when weights exceed 100%, 'under' when under 100% */
  variant?: 'over' | 'under'
}

/**
 * AC6 — weight sum warning.
 * 'over':  "The weight exceeds 100%. Please re-adjust the weight" (red/destructive)
 * 'under': "Your targets sum to X%. The remaining Y% will be held as cash after rebalancing."
 */
export function WeightsSumWarning({ weightsSumPct, cashTargetPct, variant = 'under' }: Props) {
  if (variant === 'over') {
    return (
      <p className="flex items-center gap-1 text-xs text-destructive">
        {/* CLAUDE.md Rule 13 — non-colour signal required alongside colour signal */}
        <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
        The weight exceeds 100%. Please re-adjust the weight.
      </p>
    )
  }
  return (
    <p className="flex items-center gap-1 text-xs text-warning">
      {/* CLAUDE.md Rule 13 — non-colour signal required alongside colour signal */}
      <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
      Your targets sum to {formatNumber(weightsSumPct, 'weight')}. The remaining{' '}
      {formatNumber(cashTargetPct, 'weight')} will be held as cash after rebalancing.
    </p>
  )
}
