import { useMemo, useState } from 'react'

interface Props {
  summary: string
  sources: string[]
}

function splitWords(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)
}

export function NarrativeSummaryCard({ summary, sources }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [sourcesOpen, setSourcesOpen] = useState(false)

  const { previewText, isTruncated } = useMemo(() => {
    const words = splitWords(summary ?? '')
    const limit = 300
    if (words.length <= limit) {
      return { previewText: words.join(' '), isTruncated: false }
    }
    return { previewText: words.slice(0, limit).join(' ') + '…', isTruncated: true }
  }, [summary])

  const normalizedSources = (sources ?? [])
    .map((s) => String(s).trim())
    .filter(Boolean)

  return (
    <section className="bg-card border border-border rounded-lg p-5" aria-label="Narrative summary">
      <h2 className="text-sm font-medium text-foreground">Narrative summary</h2>

      <p className="mt-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
        {expanded || !isTruncated ? summary : previewText}
      </p>

      {isTruncated && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-sm font-medium text-primary hover:underline outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          aria-label={expanded ? 'Show less summary' : 'Show more summary'}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}

      <div className="mt-4 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setSourcesOpen((v) => !v)}
          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          aria-expanded={sourcesOpen}
          aria-controls="research-sources"
        >
          {sourcesOpen ? 'Hide sources' : 'Show sources'}
        </button>

        {sourcesOpen && (
          <ul
            id="research-sources"
            className="mt-2 space-y-1 text-xs text-muted-foreground list-disc pl-5"
            aria-label="Sources"
          >
            {normalizedSources.length === 0 ? (
              <li>No sources provided.</li>
            ) : (
              normalizedSources.map((s, idx) => (
                <li key={`${idx}-${s.slice(0, 24)}`}>{s}</li>
              ))
            )}
          </ul>
        )}
      </div>
    </section>
  )
}

