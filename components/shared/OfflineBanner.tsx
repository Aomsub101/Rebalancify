'use client'

import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export function OfflineBanner() {
  // SSR-safe: start as null (unknown), resolve on mount
  const [isOnline, setIsOnline] = useState<boolean | null>(null)

  useEffect(() => {
    setIsOnline(navigator.onLine)

    function handleOnline() {
      setIsOnline(true)
    }
    function handleOffline() {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Render nothing until mounted (avoids SSR mismatch) or when online
  if (isOnline === null || isOnline === true) return null

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-center gap-2 px-4 py-2 bg-warning-bg text-warning text-sm font-medium"
    >
      {/* Non-colour signal (CLAUDE.md Rule 13): WifiOff icon + text */}
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>You&apos;re offline — data may be stale</span>
    </div>
  )
}
