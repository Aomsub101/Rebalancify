import { Clock } from 'lucide-react'
import { formatNumber } from '@/lib/formatNumber'

interface Props { staleDays: number }

export function StalenessTag({ staleDays }: Props) {
  if (staleDays <= 7) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs text-warning" title="Price may be outdated">
      <Clock className="h-3 w-3" aria-hidden="true" />
      {formatNumber(staleDays, 'staleness')}
    </span>
  )
}
