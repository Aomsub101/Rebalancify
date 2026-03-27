'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home,
  PieChart,
  Newspaper,
  Compass,
  Settings2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useSession } from '@/contexts/SessionContext'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { href: '/overview', label: 'Overview', icon: Home },
  { href: '/silos', label: 'Silos', icon: PieChart },
  { href: '/news', label: 'News', icon: Newspaper },
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/settings', label: 'Settings', icon: Settings2 },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { profile, siloCount } = useSession()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = profile?.display_name
    ? profile.display_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?'

  return (
    // bg-sidebar is always dark navy — never changes with theme (CLAUDE.md Rule 6)
    <aside
      className={cn(
        'bg-sidebar h-screen flex-col shrink-0',
        // Mobile: hidden; Tablet: 56px icon rail; Desktop: 240px with labels
        'hidden md:flex md:w-14 lg:w-60',
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-3 lg:px-4 border-b border-[var(--sidebar-border)]">
        <span className="text-[var(--sidebar-foreground)] font-semibold text-lg hidden lg:block">
          Rebalancify
        </span>
        {/* Icon-only fallback for tablet rail */}
        <span className="text-[var(--sidebar-foreground)] font-bold text-xl lg:hidden">
          R
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col gap-1 p-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors',
                'outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-ring)]',
                isActive
                  ? 'bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)]'
                  : 'text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="hidden lg:flex lg:items-center lg:gap-2 truncate">
                {item.label}
                {item.href === '/silos' && (
                  <span
                    className="text-xs font-mono opacity-70"
                    aria-label={`${siloCount} of 5 silos used`}
                  >
                    [{siloCount}/5]
                  </span>
                )}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* User menu */}
      <div className="border-t border-[var(--sidebar-border)] p-2">
        <div className="flex items-center gap-3 px-2 py-2">
          {/* Avatar */}
          <div
            className="h-8 w-8 rounded-md bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)] flex items-center justify-center text-xs font-mono font-semibold shrink-0"
            aria-hidden="true"
          >
            {initials}
          </div>
          {/* Name + sign-out — desktop only */}
          <div className="hidden lg:flex lg:flex-col lg:flex-1 min-w-0">
            <span className="text-[var(--sidebar-foreground)] text-sm font-medium truncate">
              {profile?.display_name ?? profile?.email ?? '—'}
            </span>
            <button
              onClick={handleSignOut}
              className="text-left text-xs text-[var(--sidebar-accent-foreground)] hover:text-[var(--sidebar-foreground)] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-ring)] focus-visible:rounded-sm"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
