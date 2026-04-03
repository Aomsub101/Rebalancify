'use client'

import { usePathname, useRouter } from 'next/navigation'
import {
  Home,
  PieChart,
  Newspaper,
  Compass,
  Settings2,
} from 'lucide-react'
import { useSiloCount } from '@/contexts/UIContext'
import { useDirtyState } from '@/contexts/DirtyStateContext'
import { cn } from '@/lib/utils'

interface TabItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const TAB_ITEMS: TabItem[] = [
  { href: '/overview', label: 'Overview', icon: Home },
  { href: '/silos', label: 'Silos', icon: PieChart },
  { href: '/news', label: 'News', icon: Newspaper },
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/settings', label: 'Settings', icon: Settings2 },
]

export function BottomTabBar() {
  const pathname = usePathname()
  const router = useRouter()
  const siloCount = useSiloCount()
  const { isDirty, confirmNavigation } = useDirtyState()

  function handleTabClick(href: string) {
    if (pathname.startsWith(href)) return
    if (!confirmNavigation()) return  // AC9
    router.push(href)
  }

  return (
    <nav
      // Visible only on mobile (< 768px); hidden at md and above
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-background border-t border-border pb-safe md:hidden"
      aria-label="Mobile navigation"
    >
      {TAB_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.href)
        // AC9: amber dot on Silos tab when dirty
        const showDirtyDot = isDirty && item.href === '/silos'
        const Icon = item.icon

        return (
          <button
            key={item.href}
            onClick={() => handleTabClick(item.href)}
            className={cn(
              'relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-xs transition-colors',
              'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-md',
              isActive ? 'text-primary' : 'text-muted-foreground',
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            <div className="relative">
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {/* AC9: amber dot indicator (non-colour: sr-only label satisfies Rule 13) */}
              {showDirtyDot && (
                <span
                  className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400"
                  aria-label="Unsaved changes"
                />
              )}
            </div>
            <span>{item.label}</span>
            {item.href === '/silos' && (
              <span
                className="text-[10px] font-mono leading-none opacity-70"
                aria-label={`${siloCount} of 5 silos used`}
              >
                [{siloCount}/5]
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
