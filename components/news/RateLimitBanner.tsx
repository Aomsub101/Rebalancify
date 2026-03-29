'use client'

import { AlertTriangle, X } from 'lucide-react'

interface Props {
  visible: boolean
  onDismiss: () => void
}

/**
 * Amber collapsible banner shown when the news refresh endpoint hits a rate limit.
 * AC-3: appears when rateLimited=true in refresh response.
 */
export function RateLimitBanner({ visible, onDismiss }: Props) {
  if (!visible) return null

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-bg px-4 py-3 text-warning text-sm"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
      <span className="flex-1">
        News refresh rate limit reached. Displaying cached articles — try again in a few minutes.
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss rate limit notice"
        className="shrink-0 rounded focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none hover:opacity-70 transition-opacity"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
