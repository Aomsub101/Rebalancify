import { formatNumber } from '@/lib/formatNumber'

export interface PeerAsset {
  ticker: string
  name: string
  current_price: string  // NUMERIC(20,8) as 8dp string
}

interface Props {
  peer: PeerAsset
}

export function PeerCard({ peer }: Props) {
  return (
    <div
      className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
      role="article"
      aria-label={`${peer.ticker} — ${peer.name}`}
    >
      <p
        className="text-sm font-mono font-semibold text-foreground tabular-nums"
        aria-label={`Ticker: ${peer.ticker}`}
      >
        {peer.ticker}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5 truncate" title={peer.name}>
        {peer.name}
      </p>
      <p
        className="text-sm font-mono tabular-nums text-foreground mt-2"
        aria-label={`Price: ${formatNumber(peer.current_price, 'price', 'USD')}`}
      >
        {formatNumber(peer.current_price, 'price', 'USD')}
      </p>
    </div>
  )
}
