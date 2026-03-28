'use client'

import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Decimal from 'decimal.js'
import { DriftBadge } from '@/components/shared/DriftBadge'
import { StalenessTag } from '@/components/shared/StalenessTag'
import { formatNumber } from '@/lib/formatNumber'

interface Holding {
  id: string
  asset_id: string
  ticker: string
  name: string
  asset_type: string
  quantity: string
  cost_basis: string | null
  current_price: string
  current_value: string
  current_weight_pct: number
  target_weight_pct: number
  drift_pct: number
  drift_breached: boolean
  source: string
  stale_days: number
  last_updated_at: string
}

interface Props {
  holding: Holding
  siloId: string
  driftThreshold: number
  isManual: boolean
  baseCurrency: string
}

export function HoldingRow({ holding, siloId, driftThreshold, isManual, baseCurrency }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(holding.quantity)
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const currency = baseCurrency as 'USD' | 'THB'
  const quantityContext = holding.asset_type === 'crypto' ? 'crypto' : 'stock'

  const { mutate: updateQuantity, isPending } = useMutation({
    mutationFn: async (newQuantity: string) => {
      const res = await fetch(`/api/silos/${siloId}/holdings/${holding.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: new Decimal(newQuantity).toFixed(8) }),
      })
      if (!res.ok) throw new Error('Failed to update')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holdings', siloId] })
      toast.success('Quantity updated')
      setIsEditing(false)
    },
    onError: () => {
      toast.error('Failed to update quantity — try again')
      setEditValue(holding.quantity)
      setIsEditing(false)
    },
  })

  function handleBlur() {
    if (editValue !== holding.quantity) {
      updateQuantity(editValue)
    } else {
      setIsEditing(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') inputRef.current?.blur()
    if (e.key === 'Escape') {
      setEditValue(holding.quantity)
      setIsEditing(false)
    }
  }

  function handleQuantityClick() {
    if (!isManual) return
    setEditValue(holding.quantity)
    setIsEditing(true)
  }

  return (
    <tr className="border-t border-border hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3 text-sm">
        <div className="flex flex-col">
          <span className="font-mono font-semibold text-foreground">{holding.ticker}</span>
          <span className="text-xs text-muted-foreground">{holding.name}</span>
        </div>
      </td>
      {/* Quantity — editable for manual silos */}
      <td className="px-4 py-3 text-right font-mono text-sm tabular-nums">
        {isManual && isEditing ? (
          <input
            ref={inputRef}
            type="number"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={isPending}
            autoFocus
            className="w-24 text-right font-mono text-sm tabular-nums bg-background border border-primary rounded px-2 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Edit quantity for ${holding.ticker}`}
          />
        ) : (
          <span
            onClick={handleQuantityClick}
            className={isManual ? 'cursor-pointer hover:text-primary underline decoration-dotted' : ''}
            title={isManual ? 'Click to edit' : undefined}
          >
            {formatNumber(holding.quantity, 'quantity', quantityContext)}
          </span>
        )}
      </td>
      {/* Current value */}
      <td className="px-4 py-3 text-right font-mono text-sm tabular-nums">
        {formatNumber(holding.current_value, 'price', currency)}
      </td>
      {/* Current weight */}
      <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-muted-foreground">
        {formatNumber(holding.current_weight_pct, 'weight')}
      </td>
      {/* Target weight */}
      <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-muted-foreground">
        {formatNumber(holding.target_weight_pct, 'weight')}
      </td>
      {/* Drift */}
      <td className="px-4 py-3 text-right">
        <DriftBadge driftPct={holding.drift_pct} driftThreshold={driftThreshold} />
      </td>
      {/* Staleness */}
      <td className="px-4 py-3 text-sm">
        <StalenessTag staleDays={holding.stale_days} />
      </td>
    </tr>
  )
}
