'use client'

/**
 * SessionContext — narrowed to auth state only.
 *
 * UI state has moved to:
 *   - AuthContext: session, user, profile, refreshProfile, isLoading
 *   - UIContext:   showUSD, setShowUSD, onboarded, progressBannerDismissed (useUI())
 *                   siloCount (useSiloCount() hook)
 *
 * SessionContext is now an alias for AuthContext for backward compatibility.
 * All existing call sites using useSession() for auth state continue to work.
 *
 * Components still using SessionContext for UI state must be migrated:
 *   - ProgressBanner.tsx  — reads session + refreshProfile (auth state) → migrate to useAuth()
 *   - Sidebar.tsx        — reads profile + session (auth state) → migrate to useAuth()
 *   - SessionContext itself keeps showUSD/setShowUSD/siloCount/setSiloCount/
 *     onboarded/progressBannerDismissed for backward compat until migrated.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { useAuth } from '@/contexts/AuthContext'
import { useSiloCount } from '@/contexts/UIContext'

interface UserProfile {
  id: string
  email: string
  display_name: string | null
  base_currency: string
  show_usd_toggle: boolean
  onboarded: boolean
  progress_banner_dismissed: boolean
  created_at: string
  updated_at: string
}

// Narrowed to auth state only — matches AuthContext interface
interface SessionContextValue {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  showUSD: boolean
  setShowUSD: (value: boolean) => void
  siloCount: number
  setSiloCount: (value: number) => void
  onboarded: boolean
  progressBannerDismissed: boolean
  refreshProfile: () => Promise<void>
  isLoading: boolean
}

const SessionContext = createContext<SessionContextValue>({
  session: null,
  user: null,
  profile: null,
  showUSD: false,
  setShowUSD: () => undefined,
  siloCount: 0,
  setSiloCount: () => undefined,
  onboarded: false,
  progressBannerDismissed: false,
  refreshProfile: async () => undefined,
  isLoading: true,
})

export function SessionProvider({ children }: { children: ReactNode }) {
  const [showUSD, setShowUSD] = useState(false)
  const auth = useAuth()
  const siloCount = useSiloCount()

  // Keep backward-compatible UI flags aligned with the canonical auth profile.
  useEffect(() => {
    setShowUSD(auth.profile?.show_usd_toggle ?? false)
  }, [auth.profile])

  return (
    <SessionContext.Provider
      value={{
        session: auth.session,
        user: auth.user,
        profile: auth.profile,
        showUSD,
        setShowUSD,
        siloCount,
        setSiloCount: () => undefined,
        onboarded: auth.profile?.onboarded ?? false,
        progressBannerDismissed: auth.profile?.progress_banner_dismissed ?? false,
        refreshProfile: auth.refreshProfile,
        isLoading: auth.isLoading,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext)
}
