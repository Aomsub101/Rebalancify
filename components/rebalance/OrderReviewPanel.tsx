/**
 * OrderReviewPanel — Step 2 of the rebalancing wizard.
 *
 * Shows all calculated orders, lets the user skip individual orders,
 * and triggers execution via the non-dismissible ConfirmDialog.
 *
 * AC3: OrdersTable with ticker, badge, qty, value, weight arrow, skip checkbox
 * AC4: ExecutionModeNotice for non-Alpaca silos (non-dismissible)
 * AC5: BalanceErrorBanner blocks execution when balance_valid = false
 * AC6: Non-dismissible ConfirmDialog (order count, platform, total value)
 * AC8: TanStack Query invalidation on execute success
 */
'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertCircle, Info } from 'lucide-react'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { formatNumber } from '@/lib/formatNumber'
import type { CalculateResponse, ExecuteResponse } from '@/lib/types/rebalance'

interface Props {
  siloId: string
  siloName: string
  platformType: string
  baseCurrency: 'USD' | 'THB'
  calculateResult: CalculateResponse
  onExecuted: (result: ExecuteResponse) => void
  onBack: () => void
}

const PLATFORM_LABEL: Record<string, string> = {
  alpaca: 'Alpaca',
  bitkub: 'BITKUB',
  investx: 'InnovestX',
  schwab: 'Charles Schwab',
  webull: 'Webull',
  dime: 'DIME',
  manual: 'Manual',
}

export function OrderReviewPanel({
  siloId,
  siloName,
  platformType,
  baseCurrency,
  calculateResult,
  onExecuted,
  onBack,
}: Props) {
  const queryClient = useQueryClient()
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { orders, balance_valid, balance_errors } = calculateResult
  const isAlpaca = platformType === 'alpaca'
  const platformLabel = PLATFORM_LABEL[platformType] ?? platformType

  // Derive summary counts
  const buyOrders = orders.filter(o => o.order_type === 'buy')
  const sellOrders = orders.filter(o => o.order_type === 'sell')

  const totalBuyValue = buyOrders.reduce(
    (sum, o) => sum + parseFloat(o.estimated_value),
    0,
  )
  const totalSellValue = sellOrders.reduce(
    (sum, o) => sum + parseFloat(o.estimated_value),
    0,
  )
  const netValue = totalSellValue - totalBuyValue

  // Orders not skipped → approved
  const approvedOrderIds = orders
    .filter(o => !skippedIds.has(o.id))
    .map(o => o.id)

  const totalApprovedValue = orders
    .filter(o => !skippedIds.has(o.id))
    .reduce((sum, o) => sum + parseFloat(o.estimated_value), 0)

  function toggleSkip(id: string) {
    setSkippedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Execute mutation (AC8: invalidates holdings + sessions + silos)
  const { mutate: executeOrders, isPending: isExecuting } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/silos/${siloId}/rebalance/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: calculateResult.session_id,
          approved_order_ids: approvedOrderIds,
          skipped_order_ids: [...skippedIds],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error?.message ?? 'Execution failed')
      return data as ExecuteResponse
    },
    onSuccess: (result) => {
      // AC8 — invalidate holdings, sessions, and silo state
      queryClient.invalidateQueries({ queryKey: ['holdings', siloId] })
      queryClient.invalidateQueries({ queryKey: ['sessions', siloId] })
      queryClient.invalidateQueries({ queryKey: ['silos', siloId] })
      setConfirmOpen(false)
      onExecuted(result)
    },
    onError: (err: Error) => {
      setConfirmOpen(false)
      toast.error(err.message ?? 'Execution failed')
    },
  })

  const canExecute = balance_valid && approvedOrderIds.length > 0

  return (
    <div className="space-y-4">
      {/* Session summary bar */}
      <div className="flex flex-wrap items-center gap-4 px-4 py-3 rounded-lg bg-secondary text-sm">
        <span className="text-foreground">
          <span className="font-medium text-positive">{buyOrders.length} buy{buyOrders.length !== 1 ? 's' : ''}</span>
          {' · '}
          <span className="font-medium text-negative">{sellOrders.length} sell{sellOrders.length !== 1 ? 's' : ''}</span>
        </span>
        <span className="text-muted-foreground">
          Net: <span className={`font-mono ${netValue >= 0 ? 'text-positive' : 'text-negative'}`}>
            {netValue >= 0 ? '+' : ''}{formatNumber(Math.abs(netValue), 'price', baseCurrency)}
          </span>
        </span>
        <span className="text-muted-foreground">
          {skippedIds.size > 0 && (
            <span>{skippedIds.size} skipped</span>
          )}
        </span>
      </div>

      {/* ExecutionModeNotice — non-Alpaca silos (AC4) */}
      {!isAlpaca && (
        <div
          className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm"
          role="note"
          aria-label="Manual execution required"
        >
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" aria-hidden="true" />
          <div>
            <p className="font-medium text-foreground">Manual execution required</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              These orders will not be submitted automatically.
              After confirming, you will receive step-by-step instructions to execute them manually on {platformLabel}.
            </p>
          </div>
        </div>
      )}

      {/* Balance error banner — blocks execution (AC5) */}
      {!balance_valid && (
        <div
          className="flex items-start gap-2 rounded-lg border border-negative/30 bg-negative-bg px-4 py-3 text-negative text-sm"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-medium">Insufficient balance for full rebalance</p>
            {balance_errors.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs">
                {balance_errors.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            )}
            <p className="text-xs mt-1 text-negative/80">
              Go back and switch to partial mode, or add more cash.
            </p>
          </div>
        </div>
      )}

      {/* Orders table (AC3) */}
      {orders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No orders needed — all assets are already at their target weights.
        </div>
      ) : (
        <div className="w-full border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-muted-foreground text-xs font-mono uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Ticker</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3 text-right">Est. Value</th>
                <th className="px-4 py-3 text-right">Weight</th>
                <th className="px-4 py-3 text-center">Skip</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const isSkipped = skippedIds.has(order.id)
                return (
                  <tr
                    key={order.id}
                    className={`border-t border-border transition-colors ${
                      isSkipped ? 'opacity-50' : 'hover:bg-secondary/50'
                    }`}
                  >
                    {/* Ticker */}
                    <td className="px-4 py-3 font-mono font-medium text-foreground text-sm">
                      {order.ticker}
                    </td>

                    {/* Order type badge — BUY green / SELL red (AC3) */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wide ${
                          order.order_type === 'buy'
                            ? 'bg-positive-bg text-positive'
                            : 'bg-negative-bg text-negative'
                        }`}
                      >
                        {order.order_type.toUpperCase()}
                      </span>
                    </td>

                    {/* Quantity */}
                    <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-foreground">
                      {formatNumber(order.quantity, 'quantity', 'stock')}
                    </td>

                    {/* Estimated value */}
                    <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-foreground">
                      {formatNumber(order.estimated_value, 'price', baseCurrency)}
                    </td>

                    {/* Weight arrow: before → after */}
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                      {formatNumber(order.weight_before_pct, 'weight')}
                      {' → '}
                      {formatNumber(order.weight_after_pct, 'weight')}
                    </td>

                    {/* Skip checkbox (AC3) */}
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSkipped}
                        onChange={() => toggleSkip(order.id)}
                        aria-label={`Skip ${order.ticker} ${order.order_type} order`}
                        className="h-4 w-4 rounded border-border text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-md text-sm font-medium hover:bg-secondary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring text-muted-foreground"
        >
          ← Back
        </button>
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={!canExecute}
          className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Execute orders →
        </button>
      </div>

      {/* Non-dismissible ConfirmDialog (AC6) */}
      <ConfirmDialog
        open={confirmOpen}
        title={`Execute ${approvedOrderIds.length} order${approvedOrderIds.length !== 1 ? 's' : ''} on ${platformLabel}?`}
        confirmLabel={isAlpaca ? 'Confirm & submit to Alpaca' : 'Confirm — I will execute manually'}
        cancelLabel="Cancel"
        onConfirm={() => executeOrders()}
        onCancel={() => setConfirmOpen(false)}
        isLoading={isExecuting}
      >
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>Orders to execute</span>
            <span className="font-mono font-medium text-foreground">{approvedOrderIds.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Platform</span>
            <span className="font-medium text-foreground">{platformLabel}</span>
          </div>
          <div className="flex justify-between">
            <span>Total estimated value</span>
            <span className="font-mono font-medium text-foreground">
              {formatNumber(totalApprovedValue, 'price', baseCurrency)}
            </span>
          </div>
          {skippedIds.size > 0 && (
            <div className="flex justify-between text-muted-foreground/70">
              <span>Skipped orders</span>
              <span className="font-mono">{skippedIds.size}</span>
            </div>
          )}
        </div>
      </ConfirmDialog>
    </div>
  )
}
