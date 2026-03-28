'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

interface DirtyStateContextValue {
  isDirty: boolean
  setIsDirty: (v: boolean) => void
  /** Call before programmatic navigation. Returns true if navigation should proceed. */
  confirmNavigation: () => boolean
}

const DirtyStateContext = createContext<DirtyStateContextValue>({
  isDirty: false,
  setIsDirty: () => {},
  confirmNavigation: () => true,
})

export function DirtyStateProvider({ children }: { children: ReactNode }) {
  const [isDirty, setIsDirty] = useState(false)

  const confirmNavigation = useCallback((): boolean => {
    if (!isDirty) return true
    return window.confirm('You have unsaved weight changes. Leave this page?')
  }, [isDirty])

  return (
    <DirtyStateContext.Provider value={{ isDirty, setIsDirty, confirmNavigation }}>
      {children}
    </DirtyStateContext.Provider>
  )
}

export function useDirtyState() {
  return useContext(DirtyStateContext)
}
