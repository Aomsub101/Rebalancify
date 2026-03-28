import type { ReactNode } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { BottomTabBar } from '@/components/layout/BottomTabBar'
import { OfflineBanner } from '@/components/shared/OfflineBanner'
import { DirtyStateProvider } from '@/contexts/DirtyStateContext'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DirtyStateProvider>
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopBar />
          <OfflineBanner />
          <main className="flex-1 overflow-auto p-6 pb-20 md:pb-6">
            {children}
          </main>
        </div>
        <BottomTabBar />
      </div>
    </DirtyStateProvider>
  )
}
