'use client'

import { useQueries, useQuery } from '@tanstack/react-query'
import type { DriftAsset } from '@/lib/types/portfolio'
import {
  buildFxRatesMap,
  getBreachedAssets,
  getSummaryCurrency,
  groupDriftBySilo,
  type FxRateEntry,
  type OverviewDriftResponse,
} from '@/lib/overview'

export interface OverviewSiloResponse {
  id: string
  name: string
  platform_type: string
  base_currency: string
  drift_threshold: number
  total_value: string
  last_synced_at: string | null
  alpaca_mode?: string
  active_silo_count: number
  silo_limit: number
}

async function fetchSilos(): Promise<OverviewSiloResponse[]> {
  const response = await fetch('/api/silos')
  if (!response.ok) {
    throw new Error('Failed to fetch silos')
  }

  return response.json()
}

async function fetchDrift(siloId: string): Promise<OverviewDriftResponse> {
  const response = await fetch(`/api/silos/${siloId}/drift`)
  if (!response.ok) {
    throw new Error(`Failed to fetch drift for silo ${siloId}`)
  }

  return response.json()
}

async function fetchFxRates(): Promise<Record<string, FxRateEntry>> {
  const response = await fetch('/api/fx-rates')
  if (!response.ok) {
    throw new Error('Failed to fetch FX rates')
  }

  return response.json()
}

export function useOverviewData(params: {
  enabled: boolean
  showUSD: boolean
  profileCurrency: string
}) {
  const { enabled, showUSD, profileCurrency } = params

  const silosQuery = useQuery({
    queryKey: ['silos'],
    queryFn: fetchSilos,
    enabled,
  })

  const fxRatesQuery = useQuery({
    queryKey: ['fx-rates'],
    queryFn: fetchFxRates,
    enabled,
  })

  const driftQueries = useQueries({
    queries: (silosQuery.data ?? []).map((silo) => ({
      queryKey: ['drift', silo.id],
      queryFn: () => fetchDrift(silo.id),
      enabled,
    })),
  })

  const completedDriftResponses = driftQueries
    .map((query) => query.data)
    .filter((data): data is OverviewDriftResponse => Boolean(data))

  const allDriftAssets: DriftAsset[] = completedDriftResponses.flatMap(
    (response) => response.assets,
  )

  const fxRates = buildFxRatesMap(fxRatesQuery.data)
  const summaryCurrency = getSummaryCurrency({
    showUSD,
    profileCurrency,
    silos: silosQuery.data,
    fxRates,
  })

  return {
    silosQuery,
    driftQueries,
    fxRates,
    allDriftAssets,
    breachedAssets: getBreachedAssets(allDriftAssets),
    driftBySiloId: groupDriftBySilo(completedDriftResponses),
    summaryCurrency,
  }
}
