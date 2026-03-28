'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SiloHeader } from '@/components/silo/SiloHeader'
import { SiloSummaryBar } from '@/components/silo/SiloSummaryBar'
import { WeightsSumBar } from '@/components/silo/WeightsSumBar'
import { HoldingsTable } from '@/components/silo/HoldingsTable'
import { AssetSearchModal } from '@/components/silo/AssetSearchModal'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { ErrorBanner } from '@/components/shared/ErrorBanner'
import type { Holding, HoldingsResponse } from '@/lib/types/holdings'

interface SiloData {
  id: string
  name: string
  platform_type: string
  base_currency: 'USD' | 'THB'
  drift_threshold: number
}

interface Props {
  silo: SiloData
}

export function SiloDetailView({ silo }: Props) {
  const [modalOpen, setModalOpen] = useState(false)

  const { data, isLoading, isError } = useQuery<HoldingsResponse>({
    queryKey: ['holdings', silo.id],
    queryFn: async () => {
      const res = await fetch(`/api/silos/${silo.id}/holdings`)
      if (!res.ok) throw new Error('Failed to fetch holdings')
      return res.json()
    },
  })

  const isManual = silo.platform_type === 'manual'
  const driftThreshold = data?.drift_threshold ?? silo.drift_threshold

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <SiloHeader silo={silo} onAddAsset={() => setModalOpen(true)} />

      {isLoading && <LoadingSkeleton rows={5} />}
      {isError && <ErrorBanner message="Failed to load holdings — try refreshing." />}

      {!isLoading && !isError && data && (
        <>
          <SiloSummaryBar
            totalValue={data.total_value}
            cashBalance={data.cash_balance}
            baseCurrency={silo.base_currency}
          />
          <WeightsSumBar holdings={data.holdings} />

          {data.holdings.length === 0 ? (
            <EmptyState
              title="No holdings yet"
              description='Click "Add asset" to search and map your first asset to this silo.'
            />
          ) : (
            <HoldingsTable
              holdings={data.holdings}
              cashBalance={data.cash_balance}
              driftThreshold={driftThreshold}
              siloId={silo.id}
              isManual={isManual}
              baseCurrency={silo.base_currency}
            />
          )}
        </>
      )}

      {/* Disclaimer — CLAUDE.md Rule 14 */}
      <footer className="text-xs text-muted-foreground text-center pt-4 border-t border-border">
        This is not financial advice.
      </footer>

      <AssetSearchModal siloId={silo.id} open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  )
}
