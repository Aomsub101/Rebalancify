'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'

interface UIState {
  showUSD: boolean
  onboarded: boolean
  progressBannerDismissed: boolean
}

interface UIContextValue extends UIState {
  setShowUSD: (value: boolean) => void
  setOnboarded: (value: boolean) => void
  setProgressBannerDismissed: (value: boolean) => void
}

const UIContext = createContext<UIContextValue>({
  showUSD: false,
  setShowUSD: () => undefined,
  onboarded: false,
  setOnboarded: () => undefined,
  progressBannerDismissed: false,
  setProgressBannerDismissed: () => undefined,
})

export function UIContextProvider({ children }: { children: ReactNode }) {
  const [showUSD, setShowUSD] = useState(false)
  const [onboarded, setOnboarded] = useState(false)
  const [progressBannerDismissed, setProgressBannerDismissed] = useState(false)
  const { profile } = useAuth()

  // Keep UI flags aligned with the canonical profile state from AuthContext.
  useEffect(() => {
    setShowUSD(profile?.show_usd_toggle ?? false)
    setOnboarded(profile?.onboarded ?? false)
    setProgressBannerDismissed(profile?.progress_banner_dismissed ?? false)
  }, [profile])

  return (
    <UIContext.Provider
      value={{
        showUSD,
        setShowUSD,
        onboarded,
        setOnboarded,
        progressBannerDismissed,
        setProgressBannerDismissed,
      }}
    >
      {children}
    </UIContext.Provider>
  )
}

export function useUI(): UIContextValue {
  return useContext(UIContext)
}

// ---------------------------------------------------------------------------
// useSiloCount — derived from TanStack Query ['silos'] query
// Filter: is_active = true only (matches SessionContext original behavior)
//
// refreshProfile() in AuthContext must call:
//   queryClient.invalidateQueries({ queryKey: ['silos'] })
// to keep this hook's data fresh after silo mutations.
// ---------------------------------------------------------------------------

interface SiloResponse {
  id: string
  is_active: boolean
}

async function fetchSilos(): Promise<SiloResponse[]> {
  const res = await fetch('/api/silos')
  if (!res.ok) throw new Error('Failed to fetch silos')
  return res.json()
}

export function useSiloCount(): number {
  const { data } = useQuery<SiloResponse[]>({
    queryKey: ['silos'],
    queryFn: fetchSilos,
  })
  return data?.filter((s) => s.is_active).length ?? 0
}
