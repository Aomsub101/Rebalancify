'use client'

import { useState } from 'react'
import { ExternalLink, BookOpen, EyeOff } from 'lucide-react'

export interface Article {
  id: string
  headline: string
  tickers: string[]
  source: string
  published_at: string | null
  url: string
  is_read: boolean
  is_dismissed: boolean
}

interface Props {
  article: Article
  onMarkRead: (id: string) => void
  onDismiss: (id: string) => void
}

/**
 * Returns a human-readable relative time string.
 * Used only in ArticleCard — no lib/ file needed.
 */
function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Unknown time'
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  return `${diffDays}d ago`
}

/**
 * A single news article card.
 * AC-4: headline, ticker chips, source + relative timestamp, external link.
 * AC-5: read/dismiss controls appear on hover; callbacks trigger PATCH + optimistic update.
 */
export function ArticleCard({ article, onMarkRead, onDismiss }: Props) {
  const [hovered, setHovered] = useState(false)

  return (
    <article
      className="bg-card border border-border rounded-lg p-4 hover:border-primary/40 transition-colors"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Ticker chips */}
      {article.tickers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2" aria-label="Related tickers">
          {article.tickers.slice(0, 6).map((ticker) => (
            <span
              key={ticker}
              className="inline-block px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground text-[10px] font-mono uppercase tracking-wide"
            >
              {ticker}
            </span>
          ))}
        </div>
      )}

      {/* Headline */}
      <p className="text-base font-medium text-foreground leading-snug mb-2">
        {article.headline}
      </p>

      {/* Footer: source, timestamp, external link, controls */}
      <div className="flex items-center justify-between gap-4 mt-3">
        <span className="text-xs text-muted-foreground">
          {article.source}
          {article.published_at && (
            <>
              {' · '}
              <time
                dateTime={article.published_at}
                aria-label={`Published ${formatRelativeTime(article.published_at)}`}
              >
                {formatRelativeTime(article.published_at)}
              </time>
            </>
          )}
        </span>

        <div className="flex items-center gap-2 shrink-0">
          {/* Read/Dismiss controls — visible on hover (AC-5) */}
          {hovered && (
            <>
              <button
                type="button"
                onClick={() => onMarkRead(article.id)}
                aria-label="Mark article as read"
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                Read
              </button>
              <button
                type="button"
                onClick={() => onDismiss(article.id)}
                aria-label="Dismiss article"
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                Dismiss
              </button>
            </>
          )}

          {/* External link — always visible */}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Read original article: ${article.headline}`}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            Read original
          </a>
        </div>
      </div>
    </article>
  )
}
