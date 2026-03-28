'use client'

import { useCallback, useEffect } from 'react'
import { useDirtyState } from '@/contexts/DirtyStateContext'

/**
 * Manages unsaved-changes protection for the target weights editor.
 *
 * - When `isDirty` is true: adds a `beforeunload` listener (browser close / back button).
 * - Syncs dirty state into `DirtyStateContext` so Sidebar/BottomTabBar can show
 *   the amber indicator without prop drilling.
 * - Returns `confirmNavigation` for programmatic (in-app) navigation interception.
 * - Clears context on unmount so the indicator disappears when leaving the page.
 */
export function useDirtyGuard(isDirty: boolean) {
  const { setIsDirty, confirmNavigation } = useDirtyState()

  // Sync local dirty state into context (read by Sidebar + BottomTabBar)
  useEffect(() => {
    setIsDirty(isDirty)
  }, [isDirty, setIsDirty])

  // Clear on unmount so amber indicator disappears when leaving the silo page
  useEffect(() => {
    return () => setIsDirty(false)
  }, [setIsDirty])

  // beforeunload — fires for browser close / tab close / hard back navigation
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Modern browsers ignore the returnValue string but still show native dialog
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const confirm = useCallback((): boolean => {
    return confirmNavigation()
  }, [confirmNavigation])

  return { confirmNavigation: confirm }
}
