import { HoldingRow } from '@/components/silo/HoldingRow'
import { CashBalanceRow } from '@/components/silo/CashBalanceRow'
import type { Holding } from '@/lib/types/holdings'

interface Props {
  holdings: Holding[]
  cashBalance: string
  siloId: string
  isManual: boolean
  baseCurrency: string
  /** Local (unsaved) target weights keyed by asset_id (AC5). */
  localWeights: Record<string, string>
  onWeightChange: (assetId: string, value: string) => void
  /** Computed cash target % passed through to CashBalanceRow (AC7). */
  cashTargetPct: number
}

export function HoldingsTable({
  holdings,
  cashBalance,
  siloId,
  isManual,
  baseCurrency,
  localWeights,
  onWeightChange,
  cashTargetPct,
}: Props) {
  return (
    <div className="w-full border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-muted-foreground text-xs font-mono uppercase tracking-wider">
          <tr>
            <th className="px-4 py-3 text-left">Ticker / Name</th>
            <th className="px-4 py-3 text-right">Quantity</th>
            <th className="px-4 py-3 text-right">Value</th>
            <th className="px-4 py-3 text-right">Weight</th>
            <th className="px-4 py-3 text-right">Target</th>
            <th className="px-4 py-3 text-right">Drift</th>
            <th className="px-4 py-3 text-left">Age</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map(h => (
            <HoldingRow
              key={h.id}
              holding={h}
              siloId={siloId}
              isManual={isManual}
              baseCurrency={baseCurrency}
              localTargetWeight={localWeights[h.asset_id] ?? String(h.target_weight_pct)}
              onWeightChange={onWeightChange}
            />
          ))}
          <CashBalanceRow
            cashBalance={cashBalance}
            baseCurrency={baseCurrency}
            cashTargetPct={cashTargetPct}
          />
        </tbody>
      </table>
    </div>
  )
}
