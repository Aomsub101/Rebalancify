import { describe, expect, it } from 'vitest'
import type { DriftAsset } from '@/lib/types/portfolio'
import {
  buildFxRatesMap,
  getBreachedAssets,
  getSummaryCurrency,
  groupDriftBySilo,
} from '@/lib/overview'

function createDriftAsset(overrides: Partial<DriftAsset> = {}): DriftAsset {
  return {
    asset_id: 'asset-1',
    ticker: 'AAPL',
    drift_pct: 5,
    drift_state: 'yellow',
    drift_breached: false,
    ...overrides,
  }
}

describe('overview helpers', () => {
  it('builds a numeric FX rate map', () => {
    expect(
      buildFxRatesMap({
        THB: { rate_to_usd: '0.027', fetched_at: '2026-04-03T00:00:00Z' },
      }),
    ).toEqual({ THB: 0.027 })
  })

  it('prefers USD when the toggle is enabled', () => {
    expect(
      getSummaryCurrency({
        showUSD: true,
        profileCurrency: 'THB',
        silos: [{ base_currency: 'THB' }],
        fxRates: { THB: 0.027 },
      }),
    ).toBe('USD')
  })

  it('falls back to the first convertible silo currency when profile currency is unavailable', () => {
    expect(
      getSummaryCurrency({
        showUSD: false,
        profileCurrency: 'EUR',
        silos: [{ base_currency: 'THB' }, { base_currency: 'USD' }],
        fxRates: { THB: 0.027 },
      }),
    ).toBe('THB')
  })

  it('groups drift assets by silo and filters breached assets', () => {
    const breached = createDriftAsset({ asset_id: 'asset-2', ticker: 'TSLA', drift_breached: true })
    const grouped = groupDriftBySilo([
      {
        silo_id: 'silo-1',
        drift_threshold: 5,
        computed_at: '2026-04-03T00:00:00Z',
        assets: [createDriftAsset()],
      },
      {
        silo_id: 'silo-2',
        drift_threshold: 5,
        computed_at: '2026-04-03T00:00:00Z',
        assets: [breached],
      },
    ])

    expect(grouped['silo-1']).toHaveLength(1)
    expect(grouped['silo-2']).toEqual([breached])
    expect(getBreachedAssets([...grouped['silo-1'], ...grouped['silo-2']])).toEqual([breached])
  })
})
