import { AlertCircle } from 'lucide-react'
import { formatNumber } from '@/lib/formatNumber'

interface Props {
  weightsSumPct: number
  cashTargetPct: number
}

/** AC6 — exact text: "Your targets sum to X%. The remaining Y% will be held as cash after rebalancing." */
export function WeightsSumWarning({ weightsSumPct, cashTargetPct }: Props) {
  return (
    <p className="flex items-center gap-1 text-xs text-warning">
      {/* CLAUDE.md Rule 13 — non-colour signal required alongside colour signal */}
      <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
      Your targets sum to {formatNumber(weightsSumPct, 'weight')}. The remaining{' '}
      {formatNumber(cashTargetPct, 'weight')} will be held as cash after rebalancing.
    </p>
  )
}
