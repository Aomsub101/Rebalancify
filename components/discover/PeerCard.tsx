import Link from 'next/link'
import { formatNumber } from '@/lib/formatNumber'
import { AiInsightTag } from '@/components/shared/AiInsightTag'

export interface PeerAsset {
  ticker: string
  name: string
  current_price: string  // NUMERIC(20,8) as 8dp string
  ai_insight_tag?: string
}

interface Props {
  peer: PeerAsset
  llmConnected?: boolean
}

export function PeerCard({ peer, llmConnected = false }: Props) {
  return (
    <div
      className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
      role="article"
      aria-label={`${peer.ticker} — ${peer.name}`}
    >
      <Link
        href={`/research/${encodeURIComponent(peer.ticker)}`}
        className="text-sm font-mono font-semibold text-foreground tabular-nums hover:text-primary underline decoration-dotted outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        aria-label={`Open research for ${peer.ticker}`}
      >
        {peer.ticker}
      </Link>
      <p className="text-xs text-muted-foreground mt-0.5 truncate" title={peer.name}>
        {peer.name}
      </p>
      <p
        className="text-sm font-mono tabular-nums text-foreground mt-2"
        aria-label={`Price: ${formatNumber(peer.current_price, 'price', 'USD')}`}
      >
        {formatNumber(peer.current_price, 'price', 'USD')}
      </p>

      {llmConnected && peer.ai_insight_tag ? (
        <div className="mt-2">
          <AiInsightTag text={peer.ai_insight_tag} />
        </div>
      ) : null}
    </div>
  )
}
