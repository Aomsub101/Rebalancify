'use client'

import Link from 'next/link'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AlpacaLiveBadge } from '@/components/shared/AlpacaLiveBadge'
import type { DriftAsset } from '@/lib/types/portfolio'

export interface SiloCardData {
  id: string
  name: string
  platform_type: string
  base_currency: string
  drift_threshold: number
  total_value: string
  last_synced_at: string | null
  alpaca_mode?: string
}

const PLATFORM_LABELS: Record<string, string> = {
  alpaca: 'Alpaca',
  bitkub: 'BITKUB',
  innovestx: 'InnovestX',
  schwab: 'Schwab',
  webull: 'Webull',
  manual: 'Manual',
}

const PLATFORM_BADGE_COLORS: Record<string, string> = {
  alpaca: 'bg-blue-500/10 text-blue-400',
  bitkub: 'bg-orange-500/10 text-orange-400',
  innovestx: 'bg-purple-500/10 text-purple-400',
  schwab: 'bg-emerald-500/10 text-emerald-400',
  webull: 'bg-cyan-500/10 text-cyan-400',
  manual: 'bg-secondary text-muted-foreground',
}

interface SiloCardProps {
  silo: SiloCardData
  /** When true, display value converted to USD (AC-7). Requires usdRate. */
  showUSD?: boolean
  /**
   * rate_to_usd for the silo's base_currency (fetched from GET /api/fx-rates).
   * If undefined when showUSD=true, falls back to base_currency display.
   */
  usdRate?: number
  /**
   * Drift assets for this silo from GET /api/silos/:id/drift.
   * Used to render DriftStatusSummary (AC-4).
   * Undefined while drift data is still loading.
   */
  driftData?: DriftAsset[]
}

export function SiloCard({ silo, showUSD = false, usdRate, driftData }: SiloCardProps) {
  const isAlpacaLive = silo.platform_type === 'alpaca' && silo.alpaca_mode === 'live'
  const platformLabel = PLATFORM_LABELS[silo.platform_type] ?? silo.platform_type
  const badgeColor = PLATFORM_BADGE_COLORS[silo.platform_type] ?? PLATFORM_BADGE_COLORS.manual

  // AC-7: convert to USD only when toggle on AND rate is available — display only, no DB write
  const useConvertedUSD = showUSD && usdRate !== undefined
  const rawValue = parseFloat(silo.total_value)
  const displayValue = useConvertedUSD ? rawValue * usdRate : rawValue
  const displayCurrency = useConvertedUSD ? 'USD' : silo.base_currency
  const isEmpty = silo.total_value === '0.00000000'

  // AC-4: ExecutionModeTag — AUTO only for Alpaca in v1.0, MANUAL for all others
  const executionMode = silo.platform_type === 'alpaca' ? 'AUTO' : 'MANUAL'
  const executionModeColor =
    silo.platform_type === 'alpaca'
      ? 'bg-positive-bg text-positive'
      : 'bg-secondary text-muted-foreground'

  // AC-4: DriftStatusSummary
  const hasDriftData = driftData !== undefined
  const breachedCount = driftData?.filter((a) => a.drift_breached).length ?? 0
  const allWithin = hasDriftData && breachedCount === 0

  return (
    <Link
      href={`/silos/${silo.id}`}
      className={cn(
        'block rounded-lg border border-border bg-card p-5 transition-colors',
        'hover:border-primary/50 hover:bg-card/80',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
      aria-label={`View ${silo.name} silo`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-base font-medium text-foreground truncate">{silo.name}</h3>
          {/* CLAUDE.md Rule 15: LIVE badge is always visible for Alpaca live mode */}
          {isAlpacaLive && <AlpacaLiveBadge />}
        </div>
        {/* Platform badge + ExecutionMode tag (AC-4) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              'px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wide',
              badgeColor,
            )}
          >
            {platformLabel}
          </span>
          <span
            className={cn(
              'px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wide',
              executionModeColor,
            )}
          >
            {executionMode}
          </span>
        </div>
      </div>

      {/* Total value — AC-6: base_currency when off; AC-7: USD when on */}
      <p className="text-2xl font-mono font-semibold text-foreground tabular-nums">
        {isEmpty
          ? '—'
          : `${displayCurrency} ${displayValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {useConvertedUSD ? 'Total value (USD)' : 'Total value'}
      </p>

      {/* DriftStatusSummary (AC-4) */}
      {hasDriftData && (
        <div className="mt-3 flex items-center gap-1.5">
          {allWithin ? (
            <>
              {/* Rule 13: icon alongside colour */}
              <CheckCircle2 className="h-3.5 w-3.5 text-positive shrink-0" aria-hidden="true" />
              <span className="text-xs text-positive">All within threshold</span>
            </>
          ) : (
            <>
              {/* Rule 13: AlertCircle icon for colour-blind users */}
              <AlertCircle className="h-3.5 w-3.5 text-negative shrink-0" aria-hidden="true" />
              <span className="text-xs text-negative">
                {breachedCount} asset{breachedCount === 1 ? '' : 's'} breached
              </span>
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>{silo.base_currency}</span>
        <span>
          {silo.last_synced_at
            ? `Synced ${new Date(silo.last_synced_at).toLocaleDateString()}`
            : silo.platform_type === 'manual'
              ? 'Manual entry'
              : 'Never synced'}
        </span>
      </div>
    </Link>
  )
}
