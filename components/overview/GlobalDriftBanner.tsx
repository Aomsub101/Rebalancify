/**
 * GlobalDriftBanner
 * AC-2: Shown (red) only when at least one asset in any silo is drift-breached.
 *       Lists ticker + drift amount using DriftBadge.
 * CLAUDE.md Rule 13: AlertCircle icon (non-colour signal for colour-blind users).
 */
import { AlertCircle } from 'lucide-react'
import { DriftBadge } from '@/components/shared/DriftBadge'
import type { DriftAsset } from '@/lib/types/portfolio'

interface Props {
  /** All drift assets across all silos, pre-filtered to drift_breached === true */
  breachedAssets: DriftAsset[]
}

export function GlobalDriftBanner({ breachedAssets }: Props) {
  if (breachedAssets.length === 0) return null

  return (
    <div
      role="alert"
      className="mb-6 rounded-lg border border-negative/40 bg-negative-bg px-5 py-4"
    >
      {/* Header row — Rule 13: AlertCircle icon beside colour */}
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="h-4 w-4 text-negative shrink-0" aria-hidden="true" />
        <span className="text-sm font-medium text-negative">
          {breachedAssets.length} asset{breachedAssets.length === 1 ? '' : 's'} outside drift threshold
        </span>
      </div>

      {/* Breached asset list */}
      <ul className="flex flex-wrap gap-2" aria-label="Drift-breached assets">
        {breachedAssets.map((asset) => (
          <li key={asset.asset_id} className="flex items-center gap-1.5">
            <span className="text-xs font-mono text-negative">{asset.ticker}</span>
            <DriftBadge driftPct={asset.drift_pct} driftState={asset.drift_state} />
          </li>
        ))}
      </ul>
    </div>
  )
}
