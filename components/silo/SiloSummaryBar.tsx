import { formatNumber } from '@/lib/formatNumber'

interface Props {
  totalValue: string
  cashBalance: string
  baseCurrency: string
}

export function SiloSummaryBar({ totalValue, cashBalance, baseCurrency }: Props) {
  const currency = baseCurrency as 'USD' | 'THB'
  return (
    <div className="flex flex-wrap gap-6 rounded-lg bg-card border border-border px-5 py-4">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-mono mb-1">Total Value</p>
        <p
          className="text-2xl font-mono font-semibold tabular-nums"
          aria-label={`Total value ${formatNumber(totalValue, 'price', currency)}`}
        >
          {formatNumber(totalValue, 'price', currency)}
        </p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-mono mb-1">Cash</p>
        <p className="text-2xl font-mono font-semibold tabular-nums text-muted-foreground">
          {formatNumber(cashBalance, 'price', currency)}
        </p>
      </div>
    </div>
  )
}
