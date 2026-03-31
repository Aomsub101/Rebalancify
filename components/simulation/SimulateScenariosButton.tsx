'use client'

import { BarChart3, Loader2 } from 'lucide-react'
import type { Holding } from '@/lib/types/holdings'
import { useSimulationConstraints } from '@/hooks/useSimulationConstraints'

interface Props {
  holdings: Holding[]
  onSimulate: () => void
  isLoading: boolean
}

/**
 * "Simulate Scenarios" button placed on SiloDetailPage.
 *
 * Constraint 1: disabled if < 2 holdings
 * Constraint 2: disabled if any holding asset is < 3 months old
 * Constraint 3: loading spinner while simulation is in-flight
 *
 * Tooltip shows the appropriate disable reason.
 * F11-R1, F11-R13
 */
export function SimulateScenariosButton({ holdings, onSimulate, isLoading }: Props) {
  const { isDisabled, disableReason } = useSimulationConstraints(holdings)

  return (
    <div className="flex justify-end">
      <button
        onClick={onSimulate}
        disabled={isDisabled || isLoading}
        title={disableReason ?? undefined}
        className={[
          'inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium',
          'transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:cursor-not-allowed',
          // Enabled state
          'bg-primary text-primary-foreground hover:bg-primary/90',
          // Disabled state — muted appearance
          'disabled:bg-muted disabled:text-muted-foreground',
        ].join(' ')}
        aria-disabled={isDisabled || isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <BarChart3 className="h-4 w-4" aria-hidden="true" />
        )}
        {isLoading ? 'Simulating…' : 'Simulate Scenarios'}
      </button>
    </div>
  )
}
