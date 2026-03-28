import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { AlpacaLiveBadge } from '@/components/shared/AlpacaLiveBadge'
import { SyncButton } from '@/components/silo/SyncButton'

interface SiloData {
  id: string
  name: string
  platform_type: string
  base_currency: string
  alpaca_mode?: string
  last_synced_at?: string | null
}

interface Props {
  silo: SiloData
  onAddAsset: () => void
}

const PLATFORM_LABEL: Record<string, string> = {
  manual: 'Manual',
  alpaca: 'Alpaca',
  bitkub: 'Bitkub',
  innovestx: 'InnovestX',
  schwab: 'Schwab',
  webull: 'Webull',
}

export function SiloHeader({ silo, onAddAsset }: Props) {
  const isAlpacaLive = silo.platform_type === 'alpaca' && silo.alpaca_mode === 'live'
  const isApiSilo = silo.platform_type !== 'manual'

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-foreground">{silo.name}</h1>
          {/* CLAUDE.md Rule 15: LIVE badge must appear in silo detail header */}
          {isAlpacaLive && <AlpacaLiveBadge />}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {PLATFORM_LABEL[silo.platform_type] ?? silo.platform_type} · {silo.base_currency}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {/* AC7: SyncButton shown only for API-connected silos */}
        {isApiSilo && (
          <SyncButton
            siloId={silo.id}
            initialLastSyncedAt={silo.last_synced_at ?? null}
          />
        )}
        <Button
          variant="outline"
          onClick={onAddAsset}
          className="gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add asset
        </Button>
        <Button
          asChild
          className="outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Link href={`/silos/${silo.id}/rebalance`}>
            Run rebalance
          </Link>
        </Button>
      </div>
    </div>
  )
}
