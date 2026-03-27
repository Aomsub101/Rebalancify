'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import { formatNumber } from '@/lib/formatNumber'

type AssetType = 'stock' | 'crypto'

interface SearchResult {
  ticker: string
  name: string
  asset_type: 'stock' | 'etf' | 'crypto'
  price_source: string
  exchange?: string
  coingecko_id?: string
  current_price: string
}

interface Props {
  siloId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AssetSearchModal({ siloId, open, onOpenChange }: Props) {
  const [assetType, setAssetType] = useState<AssetType>('stock')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const queryClient = useQueryClient()

  // 300ms debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setQuery('')
      setDebouncedQuery('')
    }
  }, [open])

  const { data: results, isFetching } = useQuery<SearchResult[]>({
    queryKey: ['asset-search', debouncedQuery, assetType],
    queryFn: async () => {
      const res = await fetch(
        `/api/assets/search?q=${encodeURIComponent(debouncedQuery)}&type=${assetType}`
      )
      if (!res.ok) return []
      return res.json()
    },
    enabled: debouncedQuery.length >= 2,
  })

  const { mutate: addAsset, isPending } = useMutation({
    mutationFn: async (result: SearchResult) => {
      const res = await fetch(`/api/silos/${siloId}/asset-mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: result.ticker,
          name: result.name,
          asset_type: result.asset_type,
          price_source: result.price_source,
          coingecko_id: result.coingecko_id,
          local_label: result.ticker,
        }),
      })
      if (res.status === 409) throw new Error('ASSET_MAPPING_EXISTS')
      if (!res.ok) throw new Error('ADD_FAILED')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-mappings', siloId] })
      toast.success('Asset added to silo')
      onOpenChange(false)
    },
    onError: (err: Error) => {
      if (err.message === 'ASSET_MAPPING_EXISTS') {
        toast.error('Asset already in this silo')
      } else {
        toast.error('Failed to add asset — try again')
      }
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Asset</DialogTitle>
        </DialogHeader>

        {/* TypeSelector */}
        <RadioGroup
          value={assetType}
          onValueChange={(v) => { setAssetType(v as AssetType); setQuery('') }}
          className="flex gap-6"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="stock" id="type-stock" />
            <Label htmlFor="type-stock">Stock / ETF</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="crypto" id="type-crypto" />
            <Label htmlFor="type-crypto">Crypto</Label>
          </div>
        </RadioGroup>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder={assetType === 'stock' ? 'Search by ticker or name…' : 'Search crypto name or symbol…'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        {/* Results list */}
        <div className="min-h-[200px] max-h-[300px] overflow-y-auto space-y-1">
          {isFetching && (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-md" />
            ))
          )}

          {!isFetching && debouncedQuery.length >= 2 && (!results || results.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-10">
              No results for &ldquo;{debouncedQuery}&rdquo;
            </p>
          )}

          {!isFetching && debouncedQuery.length < 2 && (
            <p className="text-sm text-muted-foreground text-center py-10">
              Type at least 2 characters to search
            </p>
          )}

          {!isFetching && results?.map((result) => (
            <div
              key={`${result.ticker}-${result.price_source}`}
              className="flex items-center justify-between gap-3 p-3 rounded-md border border-border hover:bg-accent transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm font-mono">{result.ticker}</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    {result.asset_type}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{result.name}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-mono tabular-nums text-right">
                  {formatNumber(result.current_price, 'price', 'USD')}
                </span>
                <Button
                  size="sm"
                  onClick={() => addAsset(result)}
                  disabled={isPending}
                  className="outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Add
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
