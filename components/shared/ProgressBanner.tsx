/**
 * ProgressBanner — post-onboarding 3-step progress indicator.
 *
 * STORY-028 AC-7, AC-8, AC-9
 * Shown when: onboarded=TRUE, active silo exists, progress_banner_dismissed=FALSE.
 * Dismissible via X → PATCH /api/profile { progress_banner_dismissed: true }.
 * Steps update reactively via TanStack Query cache (silos, silo detail).
 * CLAUDE.md Rule 13: non-colour signal (filled/empty circle + label text) on each step.
 */
'use client'

import { useState } from 'react'
import { X, CheckCircle2, Circle, AlertCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'

interface SiloResponse {
  id: string
  total_value: string
  weights_sum_pct: number
}

interface HoldingsResponse {
  id: string
}

interface RebalanceSession {
  id: string
}

async function fetchSilos(): Promise<SiloResponse[]> {
  const res = await fetch('/api/silos')
  if (!res.ok) throw new Error('Failed to fetch silos')
  return res.json()
}

async function fetchHoldings(siloId: string): Promise<HoldingsResponse[]> {
  const res = await fetch(`/api/silos/${siloId}/holdings`)
  if (!res.ok) throw new Error('Failed to fetch holdings')
  return res.json()
}

async function fetchHistory(siloId: string): Promise<RebalanceSession[]> {
  const res = await fetch(`/api/silos/${siloId}/rebalance/history?limit=1`)
  if (!res.ok) throw new Error('Failed to fetch rebalance history')
  return res.json()
}

export function ProgressBanner() {
  const { session, refreshProfile } = useAuth()
  const [isDismissing, setIsDismissing] = useState(false)

  // AC-9: reactive — uses the cached silos query
  const { data: silos } = useQuery<SiloResponse[]>({
    queryKey: ['silos'],
    queryFn: fetchSilos,
    enabled: !!session,
  })

  // Use the first active silo for progress tracking
  const firstSilo = silos?.[0] ?? null

  const { data: holdings } = useQuery<HoldingsResponse[]>({
    queryKey: ['holdings', firstSilo?.id],
    queryFn: () => fetchHoldings(firstSilo!.id),
    enabled: !!firstSilo,
  })

  const { data: history } = useQuery<RebalanceSession[]>({
    queryKey: ['rebalance-history', firstSilo?.id],
    queryFn: () => fetchHistory(firstSilo!.id),
    enabled: !!firstSilo,
  })

  // AC-9: step completion derived from reactive query data
  const step1Done = (holdings?.length ?? 0) > 0
  const step2Done = (firstSilo?.weights_sum_pct ?? 0) > 0
  const step3Done = (history?.length ?? 0) > 0

  // AC-8: dismiss → PATCH /api/profile
  const handleDismiss = async () => {
    setIsDismissing(true)
    try {
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress_banner_dismissed: true }),
      })
      await refreshProfile()
    } catch {
      setIsDismissing(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 mb-4 rounded-md border border-border bg-card text-sm">
      {/* Steps — CLAUDE.md Rule 13: icon + text for colour-blind safety */}
      <div className="flex items-center gap-3 flex-wrap">
        <StepItem done={step1Done} label="Add holdings" />
        <span className="text-muted-foreground" aria-hidden="true">→</span>
        <StepItem done={step2Done} label="Set target weights" />
        <span className="text-muted-foreground" aria-hidden="true">→</span>
        <StepItem done={step3Done} label="Run first rebalance" />
      </div>

      {/* AC-8: dismiss button */}
      <button
        onClick={handleDismiss}
        disabled={isDismissing}
        aria-label="Dismiss progress banner"
        className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isDismissing
          ? <AlertCircle className="h-4 w-4" aria-hidden="true" />
          : <X className="h-4 w-4" aria-hidden="true" />
        }
      </button>
    </div>
  )
}

// CLAUDE.md Rule 13: non-colour signal — filled icon (done) vs outline icon (pending)
function StepItem({ done, label }: { done: boolean; label: string }) {
  return (
    <span className={`flex items-center gap-1.5 ${done ? 'text-foreground' : 'text-muted-foreground'}`}>
      {done
        ? <CheckCircle2 className="h-4 w-4 text-positive shrink-0" aria-hidden="true" />
        : <Circle className="h-4 w-4 shrink-0" aria-hidden="true" />
      }
      <span>{label}</span>
      {/* Screen reader only — state announcement */}
      <span className="sr-only">{done ? '(complete)' : '(not yet done)'}</span>
    </span>
  )
}
