import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { HoldingRow } from '@/components/silo/HoldingRow'
import { CashBalanceRow } from '@/components/silo/CashBalanceRow'
import type { Holding } from '@/lib/types/holdings'

type SortField = 'ticker' | 'quantity' | 'current_value' | 'current_weight_pct' | 'target_weight_pct' | 'drift_pct' | 'age_days'
type SortDirection = 'asc' | 'desc'

interface SortHeaderProps {
  label: string
  field: SortField
  currentField: SortField
  direction: SortDirection
  align?: 'left' | 'right'
  onSort: (field: SortField) => void
}

function SortHeader({ label, field, currentField, direction, align = 'left', onSort }: SortHeaderProps) {
  const isActive = currentField === field
  const baseClass = `px-4 py-3 text-${align} text-xs font-mono uppercase tracking-wider`
  const sortClass = isActive ? 'bg-muted' : 'hover:bg-muted/50 cursor-pointer'

  let ariaSort: 'ascending' | 'descending' | 'none' = 'none'
  if (isActive) ariaSort = direction === 'asc' ? 'ascending' : 'descending'

  return (
    <th aria-sort={ariaSort} className={`${baseClass} ${sortClass} transition-colors select-none`}>
      <button
        onClick={() => onSort(field)}
        className="flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        aria-label={`Sort by ${label}`}
      >
        {label}
        <span className="flex flex-col">
          <ChevronUp
            className={`h-2.5 w-2.5 -mb-1 ${isActive && direction === 'asc' ? 'text-foreground' : 'text-muted-foreground/40'}`}
          />
          <ChevronDown
            className={`h-2.5 w-2.5 ${isActive && direction === 'desc' ? 'text-foreground' : 'text-muted-foreground/40'}`}
          />
        </span>
      </button>
    </th>
  )
}

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
  const [sortField, setSortField] = useState<SortField>('ticker')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedHoldings = useMemo(() => {
    return [...holdings].sort((a, b) => {
      let aVal: string | number
      let bVal: string | number

      switch (sortField) {
        case 'ticker':
          aVal = a.ticker.toLowerCase()
          bVal = b.ticker.toLowerCase()
          break
        case 'quantity':
          aVal = parseFloat(a.quantity)
          bVal = parseFloat(b.quantity)
          break
        case 'current_value':
          aVal = parseFloat(a.current_value)
          bVal = parseFloat(b.current_value)
          break
        case 'current_weight_pct':
          aVal = a.current_weight_pct
          bVal = b.current_weight_pct
          break
        case 'target_weight_pct':
          aVal = a.target_weight_pct
          bVal = b.target_weight_pct
          break
        case 'drift_pct':
          aVal = a.drift_pct
          bVal = b.drift_pct
          break
        case 'age_days':
          aVal = a.age_days
          bVal = b.age_days
          break
        default:
          return 0
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
  }, [holdings, sortField, sortDirection])

  return (
    <div className="w-full border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-muted-foreground">
          <tr>
            <SortHeader label="Ticker / Name" field="ticker" currentField={sortField} direction={sortDirection} onSort={handleSort} />
            <SortHeader label="Quantity" field="quantity" currentField={sortField} direction={sortDirection} align="right" onSort={handleSort} />
            <SortHeader label="Value" field="current_value" currentField={sortField} direction={sortDirection} align="right" onSort={handleSort} />
            <SortHeader label="Weight" field="current_weight_pct" currentField={sortField} direction={sortDirection} align="right" onSort={handleSort} />
            <SortHeader label="Target" field="target_weight_pct" currentField={sortField} direction={sortDirection} align="right" onSort={handleSort} />
            <SortHeader label="Drift" field="drift_pct" currentField={sortField} direction={sortDirection} align="right" onSort={handleSort} />
            <SortHeader label="Age" field="age_days" currentField={sortField} direction={sortDirection} onSort={handleSort} />
          </tr>
        </thead>
        <tbody>
          {sortedHoldings.map(h => (
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
