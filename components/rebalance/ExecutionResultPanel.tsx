/**
 * ExecutionResultPanel — Step 3 of the rebalancing wizard.
 *
 * AC7: Shows per-order status for Alpaca silos (executed ✓, skipped, failed)
 * with total counts.
 *
 * For non-Alpaca silos: ManualOrderInstructions with CopyAllButton and
 * per-row CopyRowButton (icon-only).
 */
'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle, XCircle, MinusCircle, Copy, ArrowLeft } from 'lucide-react'
import { formatNumber } from '@/lib/formatNumber'
import type { CalculateResponse, ExecuteResponse } from '@/lib/types/rebalance'

interface Props {
  siloId: string
  platformType: string
  baseCurrency: 'USD' | 'THB'
  calculateResult: CalculateResponse
  executeResult: ExecuteResponse
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

function buildManualInstruction(
  order: CalculateResponse['orders'][number],
  platformLabel: string,
): string {
  const action = order.order_type === 'buy' ? 'Buy' : 'Sell'
  const qty = formatNumber(order.quantity, 'quantity', 'stock')
  return `${action} ${qty} share${parseFloat(order.quantity) !== 1 ? 's' : ''} of ${order.ticker} at market on ${platformLabel}.`
}

export function ExecutionResultPanel({
  siloId,
  platformType,
  baseCurrency,
  calculateResult,
  executeResult,
}: Props) {
  const router = useRouter()
  const isAlpaca = platformType === 'alpaca'
  const platformLabel = PLATFORM_LABEL[platformType] ?? platformType

  // Build a map of order results for quick lookup
  const statusMap = new Map(
    executeResult.orders.map(o => [o.id, o.execution_status]),
  )

  // For Alpaca: annotate calculate orders with execution status
  const annotatedOrders = calculateResult.orders.map(o => ({
    ...o,
    execution_status: statusMap.get(o.id) ?? 'pending',
  }))

  // For manual: only include non-skipped orders
  const manualOrders = calculateResult.orders.filter(
    o => statusMap.get(o.id) !== 'skipped',
  )

  function copyInstruction(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied')
    })
  }

  function copyAllInstructions() {
    const text = manualOrders
      .map(o => buildManualInstruction(o, platformLabel))
      .join('\n')
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Instructions copied')
    })
  }

  return (
    <div className="space-y-6">
      {/* Alpaca result section (AC7) */}
      {isAlpaca && (
        <div className="space-y-4">
          {/* Summary counts */}
          <div className="flex flex-wrap gap-4 text-sm">
            {executeResult.executed_count > 0 && (
              <span className="inline-flex items-center gap-1 text-positive">
                <CheckCircle className="h-4 w-4" aria-hidden="true" />
                {executeResult.executed_count} executed
              </span>
            )}
            {executeResult.skipped_count > 0 && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <MinusCircle className="h-4 w-4" aria-hidden="true" />
                {executeResult.skipped_count} skipped
              </span>
            )}
            {executeResult.failed_count > 0 && (
              <span className="inline-flex items-center gap-1 text-negative">
                <XCircle className="h-4 w-4" aria-hidden="true" />
                {executeResult.failed_count} failed
              </span>
            )}
          </div>

          {/* Per-order status list */}
          <div className="w-full border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-muted-foreground text-xs font-mono uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Ticker</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3 text-right">Est. Value</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {annotatedOrders.map(order => (
                  <tr key={order.id} className="border-t border-border">
                    <td className="px-4 py-3 font-mono font-medium text-foreground text-sm">
                      {order.ticker}
                    </td>
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
                    <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-foreground">
                      {formatNumber(order.quantity, 'quantity', 'stock')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-foreground">
                      {formatNumber(order.estimated_value, 'price', baseCurrency)}
                    </td>
                    <td className="px-4 py-3">
                      {order.execution_status === 'executed' && (
                        <span className="inline-flex items-center gap-1 text-positive text-xs">
                          <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          Executed
                        </span>
                      )}
                      {order.execution_status === 'skipped' && (
                        <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
                          <MinusCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          Skipped
                        </span>
                      )}
                      {order.execution_status === 'failed' && (
                        <span className="inline-flex items-center gap-1 text-negative text-xs">
                          <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          Failed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual execution instructions (non-Alpaca) */}
      {!isAlpaca && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">
              Execute these orders manually on {platformLabel}
            </h3>
            <button
              onClick={copyAllInstructions}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-secondary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Copy all manual instructions"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              Copy all
            </button>
          </div>

          <div className="space-y-2">
            {manualOrders.map(order => {
              const instruction = buildManualInstruction(order, platformLabel)
              return (
                <div
                  key={order.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-secondary text-sm"
                >
                  <span className="text-foreground">{instruction}</span>
                  <button
                    onClick={() => copyInstruction(instruction)}
                    className="shrink-0 p-1.5 rounded-md hover:bg-card transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Copy instruction for ${order.ticker}`}
                  >
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Back to silo */}
      <div className="pt-2">
        <button
          onClick={() => router.push(`/silos/${siloId}`)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium hover:bg-secondary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to silo
        </button>
      </div>
    </div>
  )
}
