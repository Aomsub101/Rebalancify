/**
 * Returns a human-readable relative time string, e.g. "5 minutes ago".
 * Used by OfflineBanner to display when cached data was last fetched.
 */
export function formatRelativeTime(date: Date | null): string {
  if (!date) return ''

  const diffMs = Date.now() - date.getTime()
  // Treat future dates as "just now" (defensive)
  const absMs = Math.max(0, diffMs)
  const absSeconds = Math.floor(absMs / 1000)
  const absMinutes = Math.floor(absMs / 60_000)
  const absHours = Math.floor(absMs / 3_600_000)
  const absDays = Math.floor(absMs / 86_400_000)

  if (absSeconds < 60) return 'just now'
  if (absMinutes < 60) return absMinutes === 1 ? '1 minute ago' : `${absMinutes} minutes ago`
  if (absHours < 24) return absHours === 1 ? '1 hour ago' : `${absHours} hours ago`
  return absDays === 1 ? '1 day ago' : `${absDays} days ago`
}
