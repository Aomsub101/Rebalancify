'use client'

import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'

const PAGE_TITLES: Record<string, string> = {
  '/overview': 'Overview',
  '/silos': 'Silos',
  '/news': 'News Feed',
  '/discover': 'Discover',
  '/settings': 'Settings',
}

function getPageTitle(pathname: string): string {
  for (const [prefix, title] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(prefix)) return title
  }
  return 'Rebalancify'
}

export function TopBar() {
  const pathname = usePathname()
  const pageTitle = getPageTitle(pathname)

  // TODO STORY-005: replace with useQuery(['profile'], () => fetch('/api/profile').then(r => r.json()))
  const notificationCount = 0

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-border bg-background shrink-0">
      <h1 className="text-xl font-semibold text-foreground">{pageTitle}</h1>

      <button
        className="relative flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={
          notificationCount > 0
            ? `${notificationCount} unread notifications`
            : 'Notifications'
        }
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {notificationCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-4 w-4 rounded-full bg-negative text-white text-[10px] font-mono"
            aria-hidden="true"
          >
            {notificationCount > 9 ? '9+' : notificationCount}
          </span>
        )}
      </button>
    </header>
  )
}
