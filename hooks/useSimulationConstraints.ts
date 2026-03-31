'use client'

import { useMemo } from 'react'
import type { Holding } from '@/lib/types/holdings'

// 3 months ≈ 90 days (conservative approximation for trading history check)
const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000

const DISABLE_REASON_MIN_ASSETS =
  'Simulation requires at least 2 assets.'
const DISABLE_REASON_MIN_AGE =
  'Simulation requires all assets to have at least 3 months of market price history.'

export interface SimulationConstraints {
  assetCount: number
  /** True only if every holding's market_debut_date (from yfinance 5yr series) is ≥ 3 months ago */
  minAgeMet: boolean
  isDisabled: boolean
  disableReason: string | null
}

/**
 * Computes whether the "Simulate Scenarios" button should be enabled.
 *
 * Constraint 1 (min assets):  ≥ 2 holdings required
 * Constraint 2 (min age):    every holding's market_debut_date must be ≥ 3 months ago
 *
 * Note: uses market_debut_date (from yfinance 5yr price series) as proxy for
 * market listing date — determined by the earliest date yfinance can return for
 * the ticker, NOT when the user added the asset to their portfolio.
 */
export function useSimulationConstraints(holdings: Holding[]): SimulationConstraints {
  return useMemo(() => {
    const assetCount = holdings.length

    if (assetCount < 2) {
      return {
        assetCount,
        minAgeMet: false,
        isDisabled: true,
        disableReason: DISABLE_REASON_MIN_ASSETS,
      }
    }

    const now = Date.now()
    const threeMonthsAgo = new Date(now - THREE_MONTHS_MS)

    // minAgeMet = true only if EVERY holding's market debut is at least 3 months ago
    // market_debut_date is NULL if price history was never fetched — treat as invalid
    const minAgeMet = holdings.every(h => {
      if (!h.market_debut_date) return false
      return new Date(h.market_debut_date).getTime() <= threeMonthsAgo.getTime()
    })

    if (!minAgeMet) {
      return {
        assetCount,
        minAgeMet: false,
        isDisabled: true,
        disableReason: DISABLE_REASON_MIN_AGE,
      }
    }

    return {
      assetCount,
      minAgeMet: true,
      isDisabled: false,
      disableReason: null,
    }
  }, [holdings])
}
