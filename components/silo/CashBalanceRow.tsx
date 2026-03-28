import { formatNumber } from '@/lib/formatNumber'

interface Props {
  cashBalance: string
  baseCurrency: string
  /** AC7 — computed cash target % shown as read-only in Target column. */
  cashTargetPct: number
}

export function CashBalanceRow({ cashBalance, baseCurrency, cashTargetPct }: Props) {
  const currency = baseCurrency as 'USD' | 'THB'
  return (
    <tr className="border-t-2 border-border bg-muted/30">
      {/* Ticker / Name */}
      <td className="px-4 py-3 text-sm font-medium text-muted-foreground">Cash</td>
      {/* Quantity — N/A for cash */}
      <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-muted-foreground">—</td>
      {/* Value */}
      <td className="px-4 py-3 text-right font-mono text-sm tabular-nums">
        {formatNumber(cashBalance, 'price', currency)}
      </td>
      {/* Current weight — N/A */}
      <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-muted-foreground">—</td>
      {/* Target weight — AC7 cash_target_pct read-only label */}
      <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-muted-foreground">
        {formatNumber(cashTargetPct, 'weight')}
      </td>
      {/* Drift — N/A */}
      <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-muted-foreground">—</td>
      {/* Age — N/A */}
      <td className="px-4 py-3 text-sm text-muted-foreground">—</td>
    </tr>
  )
}
