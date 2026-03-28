import React from 'react'
import { Circle, Triangle, AlertCircle } from 'lucide-react'
import { formatNumber } from '@/lib/formatNumber'

interface Props {
  driftPct: number
  driftThreshold: number
}

type DriftState = 'green' | 'yellow' | 'red'

function getDriftState(driftPct: number, threshold: number): DriftState {
  const abs = Math.abs(driftPct)
  if (abs > threshold) return 'red'
  if (abs > threshold * 0.5) return 'yellow'
  return 'green'
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

export function DriftBadge({ driftPct, driftThreshold }: Props) {
  const state = getDriftState(driftPct, driftThreshold)
  const label = formatNumber(driftPct, 'drift')
  return (
    <span
      className={STATE_STYLES[state]}
      aria-label={`Drift ${label}`}
    >
      {STATE_ICONS[state]}
      {label}
    </span>
  )
}
