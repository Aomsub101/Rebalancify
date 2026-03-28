import React from 'react'
import { Circle, Triangle, AlertCircle } from 'lucide-react'
import { formatNumber } from '@/lib/formatNumber'
import type { DriftState } from '@/lib/drift'

interface Props {
  driftPct: number
  driftState: DriftState
}

const STATE_STYLES: Record<DriftState, string> = {
  green: 'inline-flex items-center gap-1 px-2 py-0.5 rounded bg-positive-bg text-positive text-xs font-mono',
  yellow: 'inline-flex items-center gap-1 px-2 py-0.5 rounded bg-warning-bg text-warning text-xs font-mono',
  red: 'inline-flex items-center gap-1 px-2 py-0.5 rounded bg-negative-bg text-negative text-xs font-mono',
}

const STATE_ICONS: Record<DriftState, React.ReactNode> = {
  green: <Circle className="h-3 w-3" aria-hidden="true" />,
  yellow: <Triangle className="h-3 w-3" aria-hidden="true" />,
  red: <AlertCircle className="h-3 w-3" aria-hidden="true" />,
}

export function DriftBadge({ driftPct, driftState }: Props) {
  const label = formatNumber(driftPct, 'drift')
  return (
    <span
      className={STATE_STYLES[driftState]}
      aria-label={`Drift ${label}`}
    >
      {STATE_ICONS[driftState]}
      {label}
    </span>
  )
}
