'use client'

import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { LLMKeyGate } from '@/components/research/LLMKeyGate'
import { SentimentCard } from '@/components/research/SentimentCard'
import { RiskFactorsCard } from '@/components/research/RiskFactorsCard'
import { NarrativeSummaryCard } from '@/components/research/NarrativeSummaryCard'
import { ErrorBanner } from '@/components/shared/ErrorBanner'

type Sentiment = 'bullish' | 'neutral' | 'bearish'

interface ResearchOutput {
  sentiment: Sentiment
  confidence: number
  risk_factors: string[]
  summary: string
  sources: string[]
  relationship_insight?: string
}

interface ResearchResponse {
  session_id?: string
  ticker: string
  cached: boolean
  output: ResearchOutput
  created_at: string
}

interface Props {
  ticker: string
  companyName: string
  llmConnected: boolean
}

function formatTimestamp(iso: string | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ResearchHubClient({ ticker, companyName, llmConnected }: Props) {
  const queryClient = useQueryClient()

  const queryKey = useMemo(() => ['research', ticker], [ticker])

  const researchQuery = useQuery<ResearchResponse>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/research/${encodeURIComponent(ticker)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = body?.error?.message ?? 'Failed to load research'
        throw new Error(msg)
      }
      return body as ResearchResponse
    },
    enabled: llmConnected,
  })

  const refreshMutation = useMutation<ResearchResponse>({
    mutationFn: async () => {
      const res = await fetch(`/api/research/${encodeURIComponent(ticker)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: true }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = body?.error?.message ?? 'Refresh failed'
        throw new Error(msg)
      }
      return body as ResearchResponse
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data)
    },
  })

  return (
    <div className="space-y-4">
      {!llmConnected ? (
        <LLMKeyGate />
      ) : (
        <>
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold text-foreground">
                {ticker}{' '}
                <span className="text-sm font-normal text-muted-foreground">
                  {companyName}
                </span>
              </h1>
              <p className="text-xs text-muted-foreground">
                Last refreshed{' '}
                <time dateTime={researchQuery.data?.created_at ?? ''}>
                  {formatTimestamp(researchQuery.data?.created_at)}
                </time>
                {researchQuery.data?.cached ? ' (cached)' : ''}
              </p>
            </div>

            <button
              type="button"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              aria-label="Refresh research"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm font-medium text-foreground hover:bg-secondary transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw
                className={[
                  'h-3.5 w-3.5',
                  refreshMutation.isPending ? 'animate-spin' : '',
                ].join(' ')}
                aria-hidden="true"
              />
              {refreshMutation.isPending ? 'Refreshing…' : 'Refresh'}
            </button>
          </header>

          {researchQuery.isError && (
            <ErrorBanner
              message={(researchQuery.error as Error)?.message ?? 'Failed to load research'}
            />
          )}

          {refreshMutation.isError && (
            <ErrorBanner
              message={(refreshMutation.error as Error)?.message ?? 'Failed to refresh'}
            />
          )}

          {researchQuery.data && (
            <div className="space-y-4" aria-label="Research cards">
              <SentimentCard
                sentiment={researchQuery.data.output.sentiment}
                confidence={researchQuery.data.output.confidence}
              />
              <RiskFactorsCard riskFactors={researchQuery.data.output.risk_factors} />
              <NarrativeSummaryCard
                summary={researchQuery.data.output.summary}
                sources={researchQuery.data.output.sources}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

