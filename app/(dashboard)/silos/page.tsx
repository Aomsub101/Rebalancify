'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { SiloCard } from '@/components/silo/SiloCard'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { ErrorBanner } from '@/components/shared/ErrorBanner'
import { cn } from '@/lib/utils'

// Metadata for 'use client' pages is set in the nearest server layout
// Title: "Silos | Rebalancify" is provided by (dashboard)/layout.tsx

interface SiloResponse {
  id: string
  name: string
  platform_type: string
  base_currency: string
  drift_threshold: number
  total_value: string
  last_synced_at: string | null
  active_silo_count: number
  silo_limit: number
}

async function fetchSilos(): Promise<SiloResponse[]> {
  const res = await fetch('/api/silos')
  if (!res.ok) throw new Error('Failed to fetch silos')
  return res.json()
}

export default function SilosPage() {
  const { data: silos, isLoading, error } = useQuery({
    queryKey: ['silos'],
    queryFn: fetchSilos,
  })

  const activeCount = silos?.[0]?.active_silo_count ?? silos?.length ?? 0
  const atLimit = activeCount >= 5

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <LoadingSkeleton rows={3} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <ErrorBanner message="Failed to load silos. Please refresh the page." />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Silos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeCount} / 5 silos used
          </p>
        </div>

        {/* Create button — disabled with tooltip when at limit (AC #8) */}
        <div className="relative group">
          {atLimit ? (
            <>
              <button
                disabled
                aria-disabled="true"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-primary/40 text-primary-foreground/50 cursor-not-allowed outline-none"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create silo
              </button>
              <div
                role="tooltip"
                className="absolute right-0 top-full mt-1 px-3 py-1.5 rounded-md bg-foreground text-background text-xs whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10"
              >
                Maximum of 5 active silos reached
              </div>
            </>
          ) : (
            <Link
              href="/silos/new"
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium',
                'bg-primary text-primary-foreground hover:bg-primary/90 transition-colors',
                'outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create silo
            </Link>
          )}
        </div>
      </div>

      {/* Empty state */}
      {(!silos || silos.length === 0) && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center mb-4">
            <Plus className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-medium text-foreground mb-2">No silos yet</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            Create your first silo to start tracking a portfolio. You can have up to 5 active silos.
          </p>
          <Link
            href="/silos/new"
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium',
              'bg-primary text-primary-foreground hover:bg-primary/90 transition-colors',
              'outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create your first silo
          </Link>
        </div>
      )}

      {/* Silos grid */}
      {silos && silos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {silos.map((silo) => (
            <SiloCard key={silo.id} silo={silo} />
          ))}
        </div>
      )}

      {/* Disclaimer — CLAUDE.md Rule 14 */}
      <p className="mt-12 text-xs text-muted-foreground text-center">
        This is not financial advice.
      </p>
    </div>
  )
}
