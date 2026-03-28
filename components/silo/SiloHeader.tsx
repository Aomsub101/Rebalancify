import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

interface SiloData {
  id: string
  name: string
  platform_type: string
  base_currency: string
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
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{silo.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {PLATFORM_LABEL[silo.platform_type] ?? silo.platform_type} · {silo.base_currency}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
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
