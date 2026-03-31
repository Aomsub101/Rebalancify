'use client'

import { SimulationDisclaimer } from '@/components/simulation/SimulationDisclaimer'
import { TruncationWarning } from '@/components/simulation/TruncationWarning'
import { StrategyCard } from '@/components/simulation/StrategyCard'
import type { SimulationResult } from '@/lib/types/simulation'
import type { Holding } from '@/lib/types/holdings'

interface Props {
  result: SimulationResult
  holdings: Holding[]
  /**
   * Called when user clicks Apply Weights on any strategy card.
   * Receives ticker-keyed weights (e.g., { AAPL: 0.4, TSLA: 0.6 }).
   * The caller (SiloDetailView) converts to asset_id keys and updates local weight state.
   * No API call is made here — AC5.
   */
  onApplyWeights: (weights: Record<string, number>) => void
}

const STRATEGY_ORDER: Array<'not_to_lose' | 'expected' | 'optimistic'> = [
  'not_to_lose',
  'expected',
  'optimistic',
]

/**
 * SimulationResultsTable — assembles the full simulation results view.
 * Renders: Disclaimer → TruncationWarning (if < 3y) → 3 StrategyCards.
 * F11-R10 (Results Table), F11-R8 (Truncation Warning), F11-R12 (Disclaimer), F11-R11 (Apply Weights)
 */
export function SimulationResultsTable({ result, holdings, onApplyWeights }: Props) {
  const { strategies, metadata } = result

  return (
    <div className="space-y-3">
      {/* F11-R12: Disclaimer — always visible */}
      <SimulationDisclaimer />

      {/* F11-R8: Truncation warning — only when lookback < 3 years */}
      {metadata.lookback_months < 36 && (
        <TruncationWarning
          limiting_ticker={metadata.limiting_ticker}
          lookback_months={metadata.lookback_months}
        />
      )}

      {/* F11-R10: Three strategy rows in fixed order */}
      <div className="space-y-2">
        {STRATEGY_ORDER.map(key => {
          const strategy = strategies[key]
          return (
            <StrategyCard
              key={key}
              strategy={key}
              weights={strategy.weights}
              return_3m={strategy.return_3m}
              range={strategy.range}
              onApply={() => onApplyWeights(strategy.weights)}
            />
          )
        })}
      </div>
    </div>
  )
}
