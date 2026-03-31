'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Save } from 'lucide-react'
import { SiloHeader } from '@/components/silo/SiloHeader'
import { SiloSummaryBar } from '@/components/silo/SiloSummaryBar'
import { WeightsSumBar } from '@/components/silo/WeightsSumBar'
import { HoldingsTable } from '@/components/silo/HoldingsTable'
import { AssetSearchModal } from '@/components/silo/AssetSearchModal'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { ErrorBanner } from '@/components/shared/ErrorBanner'
import { useDirtyGuard } from '@/hooks/useDirtyGuard'
import type { HoldingsResponse } from '@/lib/types/holdings'
import { formatNumber } from '@/lib/formatNumber'
import type { SimulationResult } from '@/lib/types/simulation'
import { SimulateScenariosButton } from '@/components/simulation/SimulateScenariosButton'

interface SiloData {
  id: string
  name: string
  platform_type: string
  base_currency: 'USD' | 'THB'
  drift_threshold: number
  alpaca_mode?: string
  last_synced_at?: string | null
}

interface Props {
  silo: SiloData
}

export function SiloDetailView({ silo }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null)
  // Deduplication key — sorted comma-separated tickers of the last simulated composition
  const lastSimulatedKey = useRef<string>('')
  const queryClient = useQueryClient()

  // ── Holdings fetch ──────────────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery<HoldingsResponse>({
    queryKey: ['holdings', silo.id],
    queryFn: async () => {
      const res = await fetch(`/api/silos/${silo.id}/holdings`)
      if (!res.ok) throw new Error('Failed to fetch holdings')
      return res.json()
    },
  })

  // ── Local weight state (AC5) ────────────────────────────────────────────────
  // localWeights: what the user is currently editing (may differ from server)
  // savedWeights: last state successfully persisted to server
  const [localWeights, setLocalWeights] = useState<Record<string, string>>({})
  const [savedWeights, setSavedWeights] = useState<Record<string, string>>({})

  // Initialise / re-sync when server data arrives (e.g. after adding a holding)
  useEffect(() => {
    if (!data) return
    const fromServer: Record<string, string> = Object.fromEntries(
      data.holdings.map(h => [h.asset_id, formatNumber(h.target_weight_pct, 'weight-input')])
    )
    setLocalWeights(prev => {
      // Keep any unsaved local edits; only add new assets from server
      const merged: Record<string, string> = { ...fromServer }
      for (const [id, v] of Object.entries(prev)) {
        if (id in fromServer) merged[id] = v  // preserve local edit
      }
      return merged
    })
    setSavedWeights(fromServer)
  }, [data])

  const isDirty = JSON.stringify(localWeights) !== JSON.stringify(savedWeights)

  // ── Dirty guard (AC9) ───────────────────────────────────────────────────────
  useDirtyGuard(isDirty)

  // ── Live sum for WeightsSumBar (AC5) ────────────────────────────────────────
  const weightsSumPct = useMemo(
    () => Object.values(localWeights).reduce((sum, v) => sum + (parseFloat(v) || 0), 0),
    [localWeights]
  )
  const cashTargetPct = Math.max(0, 100 - weightsSumPct)

  function handleWeightChange(assetId: string, value: string) {
    setLocalWeights(prev => ({ ...prev, [assetId]: value }))
  }

  // ── Save weights mutation ───────────────────────────────────────────────────
  const { mutate: saveWeights, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      const weights = Object.entries(localWeights).map(([asset_id, w]) => ({
        asset_id,
        weight_pct: parseFloat(w) || 0,
      }))
      const res = await fetch(`/api/silos/${silo.id}/target-weights`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weights }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error?.message ?? 'Failed to save weights')
      }
      return res.json()
    },
    onSuccess: () => {
      setSavedWeights({ ...localWeights })
      queryClient.invalidateQueries({ queryKey: ['holdings', silo.id] })
      toast.success('Target weights saved')
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to save target weights')
    },
  })

  // ── Simulation mutation (STORY-042 / F11-R1, R13) ─────────────────────────
  const { mutate: runSimulation, isPending: isSimulating } = useMutation({
    mutationFn: async (tickers: string[]) => {
      const res = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json?.error?.message ?? 'Simulation failed')
      }
      return json as SimulationResult
    },
    onSuccess: (data) => {
      setSimulationResult(data)
      toast.success('Simulation complete.')
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Simulation failed')
    },
  })

  // Deduplication helper: sorted comma-separated ticker key
  function getTickerKey(holdings: HoldingsResponse['holdings']) {
    return [...holdings].map(h => h.ticker).sort().join(',')
  }

  function handleSimulate() {
    if (!data) return
    const currentKey = getTickerKey(data.holdings)
    if (currentKey === lastSimulatedKey.current) {
      toast('Asset composition hasn\'t changed since last simulation.')
      return
    }
    const tickers = data.holdings.map(h => h.ticker)
    runSimulation(tickers)
    lastSimulatedKey.current = currentKey
  }

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
            siloId={silo.id}
            isManual={isManual}
          />
          <WeightsSumBar holdings={data.holdings} weightsSumPct={weightsSumPct} />

          {/* Save weights button — visible when there are holdings */}
          {data.holdings.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={() => saveWeights()}
                disabled={!isDirty || isSaving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                {isSaving ? 'Saving…' : 'Save weights'}
              </button>
            </div>
          )}

          {data.holdings.length === 0 ? (
            <EmptyState
              title="No holdings yet"
              description='Click "Add asset" to search and map your first asset to this silo.'
            />
          ) : (
            <HoldingsTable
              holdings={data.holdings}
              cashBalance={data.cash_balance}
              siloId={silo.id}
              isManual={isManual}
              baseCurrency={silo.base_currency}
              localWeights={localWeights}
              onWeightChange={handleWeightChange}
              cashTargetPct={cashTargetPct}
            />
          )}

          {/* Simulate Scenarios button — visible when there are holdings (STORY-042) */}
          {data.holdings.length > 0 && (
            <SimulateScenariosButton
              holdings={data.holdings}
              onSimulate={handleSimulate}
              isLoading={isSimulating}
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
