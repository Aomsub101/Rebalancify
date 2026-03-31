interface Props {
  ticker: string
  companyName: string
  createdAt?: string
  cached?: boolean
}

function formatTimestamp(iso: string | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ResearchHeader({ ticker, companyName, createdAt, cached }: Props) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">
          {ticker}{' '}
          <span className="text-sm font-normal text-muted-foreground">
            {companyName}
          </span>
        </h1>
        <p className="text-xs text-muted-foreground">
          Last refreshed{' '}
          <time dateTime={createdAt ?? ''}>
            {formatTimestamp(createdAt)}
          </time>
          {cached ? ' (cached)' : ''}
        </p>
      </div>
    </header>
  )
}
