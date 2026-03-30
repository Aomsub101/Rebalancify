'use client'

import { usePathname } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, DollarSign } from 'lucide-react'
import { useSession } from '@/contexts/SessionContext'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { cn } from '@/lib/utils'

async function fetchProfile() {
  const res = await fetch('/api/profile')
  if (!res.ok) return null
  return res.json() as Promise<{ notification_count: number } | null>
}

async function fetchFxRates() {
  const res = await fetch('/api/fx-rates')
  if (!res.ok) return null
  return res.json() as Promise<Record<string, unknown> | null>
}

async function patchShowUsd(value: boolean) {
  const res = await fetch('/api/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ show_usd_toggle: value }),
  })
  if (!res.ok) throw new Error('Failed to persist USD toggle')
  return res.json()
}

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
  const { session, showUSD, setShowUSD } = useSession()
  const queryClient = useQueryClient()
  const isOverview = pathname.startsWith('/overview')

  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfile,
    enabled: !!session,
  })

  // Fetch FX rates on overview page to determine toggle availability (AC-8)
  const { data: fxRates, isError: fxRatesError } = useQuery({
    queryKey: ['fx-rates'],
    queryFn: fetchFxRates,
    enabled: !!session && isOverview,
  })

  const fxAvailable = isOverview && !fxRatesError && fxRates !== null

  const toggleMutation = useMutation({
    mutationFn: patchShowUsd,
    onSuccess: () => {
      // Invalidate profile cache so any consumers get the fresh value
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })

  function handleUsdToggle() {
    if (!fxAvailable) return
    const next = !showUSD
    setShowUSD(next) // optimistic update in context
    toggleMutation.mutate(next)
  }

  const notificationCount = profileData?.notification_count ?? 0

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-border bg-background shrink-0">
      <h1 className="text-xl font-semibold text-foreground">{pageTitle}</h1>

      <div className="flex items-center gap-2">
        {/* USD toggle — visible only on Overview page (AC-5, AC-8) */}
        {isOverview && (
          <div className="relative group">
            <button
              onClick={handleUsdToggle}
              disabled={!fxAvailable}
              aria-pressed={showUSD}
              aria-label={
                !fxAvailable
                  ? 'FX data unavailable'
                  : showUSD
                    ? 'USD conversion on — click to disable'
                    : 'Enable USD conversion'
              }
              className={cn(
                'flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-mono transition-colors',
                'outline-none focus-visible:ring-2 focus-visible:ring-ring',
                showUSD && fxAvailable
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80',
                !fxAvailable && 'opacity-40 cursor-not-allowed',
              )}
            >
              {/* CLAUDE.md Rule 13: non-colour signal alongside the colour signal */}
              <DollarSign className="h-3.5 w-3.5" aria-hidden="true" />
              <span>USD</span>
            </button>
            {/* Tooltip shown when FX unavailable (AC-8) */}
            {!fxAvailable && (
              <div
                role="tooltip"
                className="absolute right-0 top-full mt-1 w-max max-w-[180px] rounded-md bg-popover border border-border px-2.5 py-1.5 text-xs text-muted-foreground shadow-md hidden group-hover:block pointer-events-none"
              >
                FX data unavailable
              </div>
            )}
          </div>
        )}

        {profileLoading ? (
          <div className="w-9">
            <LoadingSkeleton rows={1} />
          </div>
        ) : (
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
        )}
      </div>
    </header>
  )
}
