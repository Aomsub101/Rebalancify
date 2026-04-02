'use client'

// Metadata is exported from app/(dashboard)/overview/layout.tsx
// (metadata cannot be exported from 'use client' components)

import { useRouter } from 'next/navigation'
import { useQuery, useQueries } from '@tanstack/react-query'
import { PlusCircle, PieChart } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useUI } from '@/contexts/UIContext'
import { SiloCard, type SiloCardData } from '@/components/silo/SiloCard'
import { PortfolioSummaryCard } from '@/components/overview/PortfolioSummaryCard'
import type { DriftAsset } from '@/lib/types/portfolio'
import { GlobalDriftBanner } from '@/components/overview/GlobalDriftBanner'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorBanner } from '@/components/shared/ErrorBanner'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'

interface SiloResponse extends SiloCardData {
  active_silo_count: number
  silo_limit: number
}

interface DriftResponse {
  silo_id: string
  drift_threshold: number
  computed_at: string
  assets: DriftAsset[]
}

interface FxRateEntry {
  rate_to_usd: string
  fetched_at: string
}

async function fetchSilos(): Promise<SiloResponse[]> {
  const res = await fetch('/api/silos')
  if (!res.ok) throw new Error('Failed to fetch silos')
  return res.json()
}

async function fetchDrift(siloId: string): Promise<DriftResponse> {
  const res = await fetch(`/api/silos/${siloId}/drift`)
  if (!res.ok) throw new Error(`Failed to fetch drift for silo ${siloId}`)
  return res.json()
}

async function fetchFxRates(): Promise<Record<string, FxRateEntry>> {
  const res = await fetch('/api/fx-rates')
  if (!res.ok) throw new Error('Failed to fetch FX rates')
  return res.json()
}

export default function OverviewPage() {
  const router = useRouter()
  const { session, profile } = useAuth()
  const { showUSD } = useUI()

  // AC-3: fetch all active silos
  const {
    data: silos,
    isLoading: silosLoading,
    isError: silosError,
  } = useQuery<SiloResponse[]>({
    queryKey: ['silos'],
    queryFn: fetchSilos,
    enabled: !!session,
  })

  // Carry-over from STORY-018: reuse same queryKey as TopBar — zero duplicate requests
  const { data: fxRatesData } = useQuery<Record<string, FxRateEntry>>({
    queryKey: ['fx-rates'],
    queryFn: fetchFxRates,
    enabled: !!session,
  })

  // Parallel drift queries — one per silo (AC-2, AC-4)
  const driftQueries = useQueries({
    queries: (silos ?? []).map((silo) => ({
      queryKey: ['drift', silo.id],
      queryFn: () => fetchDrift(silo.id),
      enabled: !!session && !!silos,
    })),
  })

  // Build fxRates map: currency → rate as number
  const fxRates: Record<string, number> = {}
  if (fxRatesData) {
    for (const [currency, entry] of Object.entries(fxRatesData)) {
      fxRates[currency] = parseFloat(entry.rate_to_usd)
    }
  }

  const profileCurrency =
    ((profile as { global_currency?: string; base_currency?: string } | null)?.global_currency ??
      profile?.base_currency ??
      '')
      .toUpperCase()

  const fallbackSummaryCurrency =
    silos?.find((silo) => fxRates[silo.base_currency] !== undefined)?.base_currency ??
    silos?.[0]?.base_currency ??
    'USD'

  const summaryCurrency =
    showUSD
      ? 'USD'
      : profileCurrency && (profileCurrency === 'USD' || fxRates[profileCurrency] !== undefined)
        ? profileCurrency
        : fallbackSummaryCurrency

  // Aggregate all drift assets from all completed drift queries
  const allDriftAssets: DriftAsset[] = driftQueries.flatMap((q) => q.data?.assets ?? [])

  // AC-2: breached assets across all silos for GlobalDriftBanner
  const breachedAssets = allDriftAssets.filter((a) => a.drift_breached)

  // Map silo_id → drift assets for per-card DriftStatusSummary
  const driftBySiloId: Record<string, DriftAsset[]> = {}
  driftQueries.forEach((q) => {
    if (q.data) {
      driftBySiloId[q.data.silo_id] = q.data.assets
    }
  })

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 max-w-7xl mx-auto w-full">
        {/* AC-7: Loading skeleton during initial data fetch */}
        {silosLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <LoadingSkeleton rows={1} />
              <LoadingSkeleton rows={1} />
              <LoadingSkeleton rows={1} />
            </div>
            <LoadingSkeleton rows={3} />
          </div>
        )}

        {/* Error state */}
        {silosError && !silosLoading && (
          <ErrorBanner message="Could not load your silos. Please refresh the page." />
        )}

        {/* Loaded states */}
        {!silosLoading && !silosError && silos !== undefined && (
          <>
            {/* AC-6: EmptyState when zero silos */}
            {silos.length === 0 ? (
              <div className="flex flex-col items-center">
                <EmptyState
                  icon={PieChart}
                  title="No silos yet"
                  description="Create your first silo to start tracking your portfolio and calculating rebalancing orders."
                />
                {/* CTA button — placed below EmptyState for clean layout */}
                <button
                  onClick={() => router.push('/silos/new')}
                  className="mt-2 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <PlusCircle className="h-4 w-4" aria-hidden="true" />
                  Create your first silo
                </button>
              </div>
            ) : (
              <>
                {/* AC-1: PortfolioSummaryCard */}
                <PortfolioSummaryCard
                  silos={silos}
                  allDriftAssets={allDriftAssets}
                  showUSD={showUSD}
                  fxRates={fxRates}
                  targetCurrency={summaryCurrency}
                />

                {/* AC-2: GlobalDriftBanner — only when at least one asset is breached */}
                <GlobalDriftBanner breachedAssets={breachedAssets} />

                {/* AC-3: SiloCardGrid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {silos.map((silo) => {
                    // Carry-over STORY-018: wire showUSD + usdRate per silo's base_currency
                    const usdRate = fxRates[silo.base_currency]

                    return (
                      <SiloCard
                        key={silo.id}
                        silo={silo}
                        showUSD={showUSD}
                        usdRate={usdRate}
                        driftData={driftBySiloId[silo.id]}
                      />
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* CLAUDE.md Rule 14: regulatory disclaimer on every page */}
      <footer className="mt-auto pt-6">
        <p className="text-xs text-muted-foreground text-center">
          This is not financial advice.
        </p>
      </footer>
    </div>
  )
}
