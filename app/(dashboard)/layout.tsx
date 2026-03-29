import type { ReactNode } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { BottomTabBar } from '@/components/layout/BottomTabBar'
import { OfflineBanner } from '@/components/shared/OfflineBanner'
import { OnboardingGate } from '@/components/shared/OnboardingGate'
import { DirtyStateProvider } from '@/contexts/DirtyStateContext'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DirtyStateProvider>
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopBar />
          <OfflineBanner />
          {/* STORY-028: onboarding modal + progress banner (client component — reads SessionContext) */}
          <main className="flex-1 overflow-auto p-6 pb-20 md:pb-6">
            <OnboardingGate />
            {children}
          </main>
        </div>
        <BottomTabBar />
      </div>
    </DirtyStateProvider>
  )
}
