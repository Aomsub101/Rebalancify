'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AssetSearchModal } from '@/components/silo/AssetSearchModal'
import { formatNumber } from '@/lib/formatNumber'
import { Plus, AlertCircle } from 'lucide-react'

interface SiloData {
  id: string
  name: string
  platform_type: string
  base_currency: string
}

interface MappingRow {
  id: string
  local_label: string
  confirmed_at: string
  assets: {
    id: string
    ticker: string
    name: string
    asset_type: string
    price_source: string
  }
}

interface Props {
  silo: SiloData
}

export function SiloDetailView({ silo }: Props) {
  const [modalOpen, setModalOpen] = useState(false)

  const { data: mappings, isLoading, isError } = useQuery<MappingRow[]>({
    queryKey: ['asset-mappings', silo.id],
    queryFn: async () => {
      const res = await fetch(`/api/silos/${silo.id}/asset-mappings`)
      if (!res.ok) throw new Error('Failed to fetch mappings')
      return res.json()
    },
  })

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{silo.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {silo.platform_type} · {silo.base_currency}
          </p>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          className="gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add asset
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div
          className="flex items-center gap-2 rounded-lg border border-negative/30 bg-negative-bg px-4 py-3 text-negative text-sm"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Failed to load assets — try refreshing.</span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && mappings?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center mb-4">
            <Plus className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-medium text-foreground mb-2">No assets yet</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            Click &ldquo;Add asset&rdquo; to search for and map your first asset to this silo.
          </p>
        </div>
      )}

      {/* Holdings table */}
      {!isLoading && !isError && mappings && mappings.length > 0 && (
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ticker</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Quantity</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mappings.map((m) => (
                <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-foreground">
                    {m.assets.ticker}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{m.assets.name}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">
                    {m.assets.asset_type}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-muted-foreground">
                    {formatNumber('0', 'quantity', m.assets.asset_type === 'crypto' ? 'crypto' : 'stock')}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(m.confirmed_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Disclaimer — CLAUDE.md Rule 14 */}
      <footer className="text-xs text-muted-foreground text-center pt-4 border-t border-border">
        This is not financial advice.
      </footer>

      <AssetSearchModal siloId={silo.id} open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  )
}
