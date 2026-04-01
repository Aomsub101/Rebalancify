'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
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

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  refreshProfile: () => Promise<void>
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  profile: null,
  refreshProfile: async () => undefined,
  isLoading: true,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const queryClient = useQueryClient()

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

    // Invalidate silos query so useSiloCount() and ProgressBanner both re-fetch
    queryClient.invalidateQueries({ queryKey: ['silos'] })
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
        } else {
          setProfile(null)
        }

        setIsLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        refreshProfile,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}
