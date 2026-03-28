/**
 * RebalanceConfigPanel — Step 1 of the rebalancing wizard.
 *
 * Lets the user choose:
 *  - Rebalancing mode (partial | full) — rendered as radio cards, NOT a dropdown (AC2)
 *  - Whether to include cash and how much
 * Shows warnings when relevant and fires the calculate API call.
 */
'use client'

import { useState } from 'react'
import { AlertCircle, ChevronRight } from 'lucide-react'
import { WeightsSumWarning } from '@/components/silo/WeightsSumWarning'
import { formatNumber } from '@/lib/formatNumber'
import type { CalculateResponse } from '@/lib/types/rebalance'
import Link from 'next/link'

interface Props {
  siloId: string
  initialWeightsSum: number
  onCalculated: (result: CalculateResponse) => void
}

export function RebalanceConfigPanel({ siloId, initialWeightsSum, onCalculated }: Props) {
  const [mode, setMode] = useState<'partial' | 'full'>('partial')
  const [includeCash, setIncludeCash] = useState(false)
  const [cashAmount, setCashAmount] = useState('')
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const weightsSum = initialWeightsSum
  const cashTargetPct = Math.max(0, 100 - weightsSum)
  const weightsSumNotEqual = Math.abs(weightsSum - 100) > 0.001

  async function handleCalculate() {
    setError(null)
    setIsCalculating(true)
    try {
      const res = await fetch(`/api/silos/${siloId}/rebalance/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          include_cash: includeCash,
          cash_amount: includeCash && cashAmount ? cashAmount : '0.00000000',
        }),
      })
      const data = await res.json()

      if (!res.ok && res.status !== 422) {
        throw new Error(data?.error?.message ?? 'Calculation failed')
      }

      onCalculated(data as CalculateResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation failed')
    } finally {
      setIsCalculating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Mode selector — radio cards, NOT a dropdown (AC2) */}
      <div>
        <h2 className="text-base font-medium text-foreground mb-3">Rebalancing Mode</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Partial mode card */}
          <button
            role="radio"
            aria-checked={mode === 'partial'}
            onClick={() => setMode('partial')}
            className={`text-left p-4 rounded-lg border-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              mode === 'partial'
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:border-primary/50'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  mode === 'partial' ? 'border-primary' : 'border-muted-foreground'
                }`}
              >
                {mode === 'partial' && (
                  <span className="h-2 w-2 rounded-full bg-primary" />
                )}
              </span>
              <span className="text-sm font-medium text-foreground">Partial</span>
            </div>
            <p className="text-xs text-muted-foreground pl-6">Minimise trades — sells first, then buys within available cash</p>
            <p className="text-xs text-muted-foreground pl-6 mt-0.5">±1–2% residual drift possible</p>
          </button>

          {/* Full mode card */}
          <button
            role="radio"
            aria-checked={mode === 'full'}
            onClick={() => setMode('full')}
            className={`text-left p-4 rounded-lg border-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              mode === 'full'
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:border-primary/50'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  mode === 'full' ? 'border-primary' : 'border-muted-foreground'
                }`}
              >
                {mode === 'full' && (
                  <span className="h-2 w-2 rounded-full bg-primary" />
                )}
              </span>
              <span className="text-sm font-medium text-foreground">Full</span>
            </div>
            <p className="text-xs text-muted-foreground pl-6">Exact target weights — requires sufficient cash</p>
            <p className="text-xs text-muted-foreground pl-6 mt-0.5">±0.01% accuracy</p>
          </button>
        </div>
      </div>

      {/* Full rebalance warning (AC2) */}
      {mode === 'full' && (
        <div
          className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-bg px-4 py-3 text-warning text-sm"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-medium">Full rebalance requires available cash</p>
            <p className="text-xs mt-0.5 text-warning/80">
              All buy orders will be calculated to reach exact target weights.
              If your cash balance is insufficient, the calculation will return a preflight error.
            </p>
          </div>
        </div>
      )}

      {/* Cash toggle + amount input */}
      <div className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeCash}
            onChange={(e) => setIncludeCash(e.target.checked)}
            className="h-4 w-4 rounded border-border text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <span className="text-sm text-foreground">Include additional cash in rebalancing</span>
        </label>

        {includeCash && (
          <div className="pl-7">
            <label htmlFor="cash-amount" className="block text-xs text-muted-foreground mb-1">
              Cash to deploy
            </label>
            <input
              id="cash-amount"
              type="number"
              min="0"
              step="0.01"
              value={cashAmount}
              onChange={(e) => setCashAmount(e.target.value)}
              placeholder="0.00"
              className="w-48 px-3 py-2 text-sm rounded-md border border-border bg-card text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
              aria-label="Cash amount to deploy"
            />
          </div>
        )}
      </div>

      {/* Weights sum warning (AC2) */}
      {weightsSumNotEqual && (
        <WeightsSumWarning
          weightsSumPct={weightsSum}
          cashTargetPct={cashTargetPct}
        />
      )}

      {/* Error banner */}
      {error && (
        <div
          className="flex items-center gap-2 rounded-lg border border-negative/30 bg-negative-bg px-4 py-3 text-negative text-sm"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Link
          href={`/silos/${siloId}`}
          className="px-4 py-2 rounded-md text-sm font-medium hover:bg-secondary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring text-muted-foreground"
        >
          ← Back to silo
        </Link>
        <button
          onClick={handleCalculate}
          disabled={isCalculating}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {isCalculating ? 'Calculating…' : 'Calculate orders'}
          {!isCalculating && <ChevronRight className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  )
}
