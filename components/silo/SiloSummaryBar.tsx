import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatNumber } from '@/lib/formatNumber'

interface Props {
  totalValue: string
  cashBalance: string
  baseCurrency: string
  siloId?: string
  isManual?: boolean
}

export function SiloSummaryBar({ totalValue, cashBalance, baseCurrency, siloId, isManual = false }: Props) {
  const currency = baseCurrency as 'USD' | 'THB'
  const [isEditingCash, setIsEditingCash] = useState(false)
  const [editValue, setEditValue] = useState(cashBalance)
  const inputRef = useRef<HTMLInputElement>(null)

  const { mutate: updateCash, isPending: isUpdatingCash } = useMutation({
    mutationFn: async (newCash: string) => {
      const res = await fetch(`/api/silos/${siloId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cash_balance: newCash }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error?.message ?? 'Failed to update cash balance')
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Cash balance updated')
      setIsEditingCash(false)
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to update cash balance')
      setEditValue(cashBalance)
      setIsEditingCash(false)
    },
  })

  function handleCashClick() {
    if (!isManual || !siloId) return
    setEditValue(cashBalance)
    setIsEditingCash(true)
  }

  function handleBlur() {
    if (editValue !== cashBalance) {
      updateCash(editValue)
    } else {
      setIsEditingCash(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') inputRef.current?.blur()
    if (e.key === 'Escape') {
      setEditValue(cashBalance)
      setIsEditingCash(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-6 rounded-lg bg-card border border-border px-5 py-4">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-mono mb-1">Total Value</p>
        <p
          className="text-2xl font-mono font-semibold tabular-nums"
          aria-label={`Total value ${formatNumber(totalValue, 'price', currency)}`}
        >
          {formatNumber(totalValue, 'price', currency)}
        </p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-mono mb-1">Cash</p>
        {isManual && isEditingCash ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={isUpdatingCash}
            autoFocus
            className="w-32 text-2xl font-mono font-semibold tabular-nums bg-background border border-primary rounded px-2 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Edit cash balance"
          />
        ) : (
          <p
            onClick={handleCashClick}
            role={isManual && siloId ? 'button' : undefined}
            tabIndex={isManual && siloId ? 0 : -1}
            onKeyDown={e => { if (isManual && siloId && (e.key === 'Enter' || e.key === ' ')) handleCashClick() }}
            className={`text-2xl font-mono font-semibold tabular-nums ${isManual && siloId ? 'cursor-pointer hover:text-primary underline decoration-dotted' : 'text-muted-foreground'}`}
            title={isManual && siloId ? 'Click to edit cash balance' : undefined}
          >
            {formatNumber(cashBalance, 'price', currency)}
          </p>
        )}
      </div>
    </div>
  )
}
