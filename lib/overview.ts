import type { DriftAsset } from '@/lib/types/portfolio'

export interface FxRateEntry {
  rate_to_usd: string
  fetched_at: string
}

export interface OverviewDriftResponse {
  silo_id: string
  drift_threshold: number
  computed_at: string
  assets: DriftAsset[]
}

export function buildFxRatesMap(
  fxRatesData?: Record<string, FxRateEntry>,
): Record<string, number> {
  const fxRates: Record<string, number> = {}

  if (!fxRatesData) {
    return fxRates
  }

  for (const [currency, entry] of Object.entries(fxRatesData)) {
    fxRates[currency] = parseFloat(entry.rate_to_usd)
  }

  return fxRates
}

export function getSummaryCurrency(params: {
  showUSD: boolean
  profileCurrency: string
  silos?: { base_currency: string }[]
  fxRates: Record<string, number>
}): string {
  const { showUSD, profileCurrency, silos, fxRates } = params

  const normalizedProfileCurrency = profileCurrency.toUpperCase()
  const fallbackSummaryCurrency =
    silos?.find((silo) => fxRates[silo.base_currency] !== undefined)?.base_currency ??
    silos?.[0]?.base_currency ??
    'USD'

  if (showUSD) {
    return 'USD'
  }

  if (
    normalizedProfileCurrency &&
    (normalizedProfileCurrency === 'USD' ||
      fxRates[normalizedProfileCurrency] !== undefined)
  ) {
    return normalizedProfileCurrency
  }

  return fallbackSummaryCurrency
}

export function groupDriftBySilo(
  driftResponses: OverviewDriftResponse[],
): Record<string, DriftAsset[]> {
  const driftBySiloId: Record<string, DriftAsset[]> = {}

  for (const response of driftResponses) {
    driftBySiloId[response.silo_id] = response.assets
  }

  return driftBySiloId
}

export function getBreachedAssets(allDriftAssets: DriftAsset[]): DriftAsset[] {
  return allDriftAssets.filter((asset) => asset.drift_breached)
}
