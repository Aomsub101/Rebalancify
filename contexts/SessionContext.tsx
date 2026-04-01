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
import { createClient } from '@/lib/supabase/client'

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
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [siloCount, setSiloCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [showUSD, setShowUSD] = useState(false)

  // Refreshes profile + silo count from Supabase — called after onboarding mutations
  const refreshProfile = async () => {
    const supabase = createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return

    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single()

    setProfile(profileData ?? null)
    setShowUSD(profileData?.show_usd_toggle ?? false)

    const { count } = await supabase
      .from('silos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', currentUser.id)
      .eq('is_active', true)

    setSiloCount(count ?? 0)
  }

  useEffect(() => {
    const supabase = createClient()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession)

        if (newSession?.user) {
          const { data: profileData } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', newSession.user.id)
            .single()

          setProfile(profileData ?? null)
          setShowUSD(profileData?.show_usd_toggle ?? false)

          const { count } = await supabase
            .from('silos')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', newSession.user.id)
            .eq('is_active', true)

          setSiloCount(count ?? 0)
        } else {
          setProfile(null)
          setSiloCount(0)
          setShowUSD(false)
        }

        setIsLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return (
    <SessionContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        showUSD,
        setShowUSD,
        siloCount,
        setSiloCount,
        onboarded: profile?.onboarded ?? false,
        progressBannerDismissed: profile?.progress_banner_dismissed ?? false,
        refreshProfile,
        isLoading,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext)
}
