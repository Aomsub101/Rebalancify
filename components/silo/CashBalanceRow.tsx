import { formatNumber } from '@/lib/formatNumber'

interface Props {
  cashBalance: string
  baseCurrency: string
}

export function CashBalanceRow({ cashBalance, baseCurrency }: Props) {
  const currency = baseCurrency as 'USD' | 'THB'
  return (
    <tr className="border-t-2 border-border bg-muted/30">
      <td className="px-4 py-3 text-sm font-medium text-muted-foreground" colSpan={3}>
        Cash
      </td>
      <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-muted-foreground">
        —
      </td>
      <td className="px-4 py-3 text-right font-mono text-sm tabular-nums">
        {formatNumber(cashBalance, 'price', currency)}
      </td>
      <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-muted-foreground">
        —
      </td>
      <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-muted-foreground">
        —
      </td>
      <td className="px-4 py-3" />
    </tr>
  )
}
