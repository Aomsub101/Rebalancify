'use client'

import { useMemo } from 'react'
import type { Holding } from '@/lib/types/holdings'

// 3 months ≈ 90 days (conservative approximation for trading history check)
const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000

const DISABLE_REASON_MIN_ASSETS =
  'Simulation requires at least 2 assets.'
const DISABLE_REASON_MIN_AGE =
  'Simulation requires all assets to have at least 3 months of trading history.'

export interface SimulationConstraints {
  assetCount: number
  minAgeMet: boolean
  isDisabled: boolean
  disableReason: string | null
}

/**
 * Computes whether the "Simulate Scenarios" button should be enabled.
 *
 * Constraint 1 (min assets):  ≥ 2 holdings required
 * Constraint 2 (min age):    every holding's asset_created_at must be ≥ 3 months ago
 *
 * Note: uses assets.created_at as a proxy for trading history (set when the asset
 * is first mapped into any silo — see STORY-042 notes).
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

    // minAgeMet = true only if EVERY holding's asset is at least 3 months old
    const minAgeMet = holdings.every(
      h => h.asset_created_at && new Date(h.asset_created_at).getTime() <= threeMonthsAgo.getTime(),
    )

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
