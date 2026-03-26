'use client'

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
  show_usd: boolean
  created_at: string
  updated_at: string
}

interface SessionContextValue {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  showUSD: boolean
  siloCount: number
  isLoading: boolean
}

const SessionContext = createContext<SessionContextValue>({
  session: null,
  user: null,
  profile: null,
  showUSD: false,
  siloCount: 0,
  isLoading: true,
})

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [siloCount, setSiloCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

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

          const { count } = await supabase
            .from('silos')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', newSession.user.id)
            .eq('is_active', true)

          setSiloCount(count ?? 0)
        } else {
          setProfile(null)
          setSiloCount(0)
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
        showUSD: profile?.show_usd ?? false,
        siloCount,
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
