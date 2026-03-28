import { Skeleton } from '@/components/ui/skeleton'

interface Props { rows?: number }

export function LoadingSkeleton({ rows = 3 }: Props) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-md" />
      ))}
    </div>
  )
}
