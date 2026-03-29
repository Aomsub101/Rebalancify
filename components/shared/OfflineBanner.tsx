'use client'

import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { formatRelativeTime } from '@/lib/formatRelativeTime'

export function OfflineBanner() {
  // SSR-safe: avoid hydration mismatch by waiting for mount
  const [mounted, setMounted] = useState(false)
  const { isOnline, cachedAt } = useOnlineStatus()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || isOnline) return null

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-center gap-2 px-4 py-2 bg-warning-bg text-warning text-sm font-medium"
    >
      {/* Non-colour signal (CLAUDE.md Rule 13): WifiOff icon + text */}
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex flex-col gap-0.5">
        <span>You&apos;re offline — data may be stale</span>
        {/* AC-6: show relative timestamp of last cached data */}
        {cachedAt && (
          <span className="text-xs font-normal opacity-80">
            Offline — showing data from {formatRelativeTime(cachedAt)}
          </span>
        )}
      </div>
    </div>
  )
}
