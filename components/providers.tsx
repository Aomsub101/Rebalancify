'use client'

import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from '@/contexts/SessionContext'
import { UIContextProvider } from '@/contexts/UIContext'
import { AuthProvider } from '@/contexts/AuthContext'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SessionProvider>
          <UIContextProvider>{children}</UIContextProvider>
        </SessionProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
