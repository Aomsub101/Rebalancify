'use client'

import { useEffect, useState } from 'react'

interface OnlineStatus {
  /** Whether the browser is currently online */
  isOnline: boolean
  /** Date of the most recent successfully cached API response, or null if none */
  cachedAt: Date | null
}

/** Cache names registered by the service worker for API responses */
const API_CACHE_NAMES = ['api-silos', 'api-news']

async function readMostRecentCachedAt(): Promise<Date | null> {
  if (!('caches' in window)) return null
  try {
    let mostRecent: Date | null = null
    for (const name of API_CACHE_NAMES) {
      const cache = await caches.open(name)
      const requests = await cache.keys()
      for (const req of requests) {
        const res = await cache.match(req)
        const dateHeader = res?.headers.get('date')
        if (dateHeader) {
          const d = new Date(dateHeader)
          if (!mostRecent || d > mostRecent) mostRecent = d
        }
      }
    }
    return mostRecent
  } catch {
    return null
  }
}

/**
 * Returns the browser's online status and the timestamp of the most
 * recently cached API response (for the "showing data from X" indicator).
 *
 * SSR-safe: initialises to `true` on the server, resolves on mount.
 */
export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState<boolean>(true)
  const [cachedAt, setCachedAt] = useState<Date | null>(null)

  useEffect(() => {
    // Resolve actual online state on mount (navigator not available in SSR)
    setIsOnline(navigator.onLine)

    readMostRecentCachedAt().then(setCachedAt)

    function handleOnline() {
      setIsOnline(true)
    }

    function handleOffline() {
      setIsOnline(false)
      // Refresh cached timestamp when going offline so the banner is accurate
      readMostRecentCachedAt().then(setCachedAt)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline, cachedAt }
}
