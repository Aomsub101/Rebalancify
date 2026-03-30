import React from 'react'
import { CheckCircle2, MinusCircle, AlertCircle } from 'lucide-react'

type Sentiment = 'bullish' | 'neutral' | 'bearish'

interface Props {
  sentiment: Sentiment
  confidence: number
}

function clamp01(v: number) {
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(1, v))
}

const SENTIMENT_META: Record<
  Sentiment,
  { label: string; className: string; icon: React.ReactNode }
> = {
  bullish: {
    label: 'Bullish',
    className: 'bg-positive-bg text-positive',
    icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  neutral: {
    label: 'Neutral',
    className: 'bg-muted text-muted-foreground',
    icon: <MinusCircle className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  bearish: {
    label: 'Bearish',
    className: 'bg-negative-bg text-negative',
    icon: <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />,
  },
}

export function SentimentCard({ sentiment, confidence }: Props) {
  const pct = Math.round(clamp01(confidence) * 100)
  const meta = SENTIMENT_META[sentiment]

  return (
    <section className="bg-card border border-border rounded-lg p-5" aria-label="Sentiment">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-foreground">Sentiment</h2>
        <span
          className={[
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono',
            meta.className,
          ].join(' ')}
          aria-label={`Sentiment: ${meta.label}`}
        >
          {meta.icon}
          {meta.label}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Confidence</span>
          <span className="text-xs font-mono tabular-nums text-foreground" aria-label={`Confidence: ${pct}%`}>
            {pct}%
          </span>
        </div>
        <progress
          value={pct}
          max={100}
          aria-label="Confidence level"
          className="w-full h-2 rounded bg-muted overflow-hidden"
        />
      </div>
    </section>
  )
}

