import { AlertCircle } from 'lucide-react'

interface Props {
  limiting_ticker: string
  lookback_months: number
}

/**
 * TruncationWarning — amber alert shown when lookback is less than 3 years.
 * Renders nothing when lookback_months >= 36.
 * F11-R8: Truncation warning when is_truncated_below_3_years = true.
 */
export function TruncationWarning({ limiting_ticker, lookback_months }: Props) {
  if (lookback_months >= 36) {
    return null
  }

  return (
    <div
      role="alert"
      className="w-full rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200 flex items-start gap-2"
    >
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
      <span>
        Note: Because {limiting_ticker} only has {lookback_months} months of trading history, this
        portfolio projection is limited to a {lookback_months}-month lookback period. Results may be
        highly volatile.
      </span>
    </div>
  )
}
