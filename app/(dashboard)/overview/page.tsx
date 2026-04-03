'use client'

// Metadata is exported from app/(dashboard)/overview/layout.tsx
// (metadata cannot be exported from 'use client' components)

import { useRouter } from 'next/navigation'
import { PlusCircle, PieChart } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useUI } from '@/contexts/UIContext'
import { SiloCard } from '@/components/silo/SiloCard'
import { PortfolioSummaryCard } from '@/components/overview/PortfolioSummaryCard'
import { GlobalDriftBanner } from '@/components/overview/GlobalDriftBanner'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorBanner } from '@/components/shared/ErrorBanner'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { useOverviewData } from '@/hooks/useOverviewData'

export default function OverviewPage() {
  const router = useRouter()
  const { session, profile } = useAuth()
  const { showUSD } = useUI()

  const {
    silosQuery: { data: silos, isLoading: silosLoading, isError: silosError },
    fxRates,
    allDriftAssets,
    breachedAssets,
    driftBySiloId,
    summaryCurrency,
  } = useOverviewData({
    enabled: !!session,
    showUSD,
    profileCurrency:
      (profile as { global_currency?: string; base_currency?: string } | null)?.global_currency ??
      profile?.base_currency ??
      '',
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
