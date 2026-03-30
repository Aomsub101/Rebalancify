'use client'

/**
 * RebalanceHistoryView — client component
 *
 * Fetches paginated rebalancing sessions for a single silo via
 * GET /api/silos/:silo_id/rebalance/history and renders them as an
 * expandable list (AC3).
 *
 * Each row shows: date, mode badge, status badge, order count.
 * Clicking a row expands the snapshot_before detail (AC3).
 *
 * Sessions are displayed newest first (AC4 — enforced server-side).
 *
 * Rule 14: "This is not financial advice" disclaimer in footer.
 * Rule 8: LoadingSkeleton, EmptyState, ErrorBanner required (CLAUDE_FRONTEND.md).
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import { formatNumber } from '@/lib/formatNumber'

// ── Types ────────────────────────────────────────────────────────────────────

interface HistoryOrder {
  id: string
  execution_status: 'pending' | 'executed' | 'skipped' | 'failed' | 'manual'
}

interface HistorySession {
  session_id: string
  mode: 'partial' | 'full'
  created_at: string
  status: 'pending' | 'approved' | 'partial' | 'cancelled'
  snapshot_before: Record<string, unknown> | null
  orders: HistoryOrder[]
}

interface HistoryResponse {
  data: HistorySession[]
  page: number
  limit: number
  total: number
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  siloId: string
  siloName: string
}

// ── Status badge helpers ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: HistorySession['status'] }) {
  const configs: Record<HistorySession['status'], { label: string; classes: string; Icon: typeof CheckCircle }> = {
    approved:  { label: 'Approved',  classes: 'text-positive bg-positive-bg',  Icon: CheckCircle },
    partial:   { label: 'Partial',   classes: 'text-warning bg-warning-bg',    Icon: AlertCircle },
    cancelled: { label: 'Cancelled', classes: 'text-negative bg-negative-bg',  Icon: XCircle     },
    pending:   { label: 'Pending',   classes: 'text-muted-foreground bg-secondary', Icon: Clock  },
  }
  const { label, classes, Icon } = configs[status] ?? configs.pending
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide ${classes}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  )
}

function ModeBadge({ mode }: { mode: HistorySession['mode'] }) {
  const classes = mode === 'full'
    ? 'bg-secondary text-secondary-foreground'
    : 'bg-secondary text-secondary-foreground'
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide ${classes}`}>
      {mode}
    </span>
  )
}

// ── Order status summary ──────────────────────────────────────────────────────

function orderSummary(orders: HistoryOrder[]) {
  const counts = { executed: 0, manual: 0, skipped: 0, failed: 0, pending: 0 }
  for (const o of orders) counts[o.execution_status] = (counts[o.execution_status] ?? 0) + 1
  const parts: string[] = []
  if (counts.executed > 0) parts.push(`${counts.executed} executed`)
  if (counts.manual > 0) parts.push(`${counts.manual} manual`)
  if (counts.skipped > 0) parts.push(`${counts.skipped} skipped`)
  if (counts.failed > 0) parts.push(`${counts.failed} failed`)
  return parts.length > 0 ? parts.join(', ') : `${orders.length} orders`
}

// ── Snapshot detail ───────────────────────────────────────────────────────────

function SnapshotDetail({ snapshot }: { snapshot: Record<string, unknown> | null }) {
  if (!snapshot) {
    return <p className="text-sm text-muted-foreground">No snapshot data available.</p>
  }

  const holdings = snapshot.holdings as Array<{
    ticker: string
    quantity: string
    price: string
    value: string
    weight_pct: number
  }> | undefined

  const totalValue = snapshot.total_value as string | undefined

  return (
    <div className="space-y-3">
      {totalValue && (
        <p className="text-sm text-muted-foreground">
          Portfolio value at calculation: <span className="font-mono font-medium text-foreground">{totalValue}</span>
        </p>
      )}
      {holdings && holdings.length > 0 && (
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Ticker</th>
                <th className="px-3 py-2 text-right font-mono font-medium text-muted-foreground tabular-nums">Qty</th>
                <th className="px-3 py-2 text-right font-mono font-medium text-muted-foreground tabular-nums">Price</th>
                <th className="px-3 py-2 text-right font-mono font-medium text-muted-foreground tabular-nums">Value</th>
                <th className="px-3 py-2 text-right font-mono font-medium text-muted-foreground tabular-nums">Weight</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => (
                <tr key={h.ticker} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-mono font-medium text-foreground">{h.ticker}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-foreground">{h.quantity}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-foreground">{h.price}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-foreground">{h.value}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-foreground">
                    {typeof h.weight_pct === 'number' ? formatNumber(h.weight_pct, 'weight') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Session row ───────────────────────────────────────────────────────────────

function SessionRow({ session }: { session: HistorySession }) {
  const [expanded, setExpanded] = useState(false)

  const snapshotBefore = session.snapshot_before

  const date = new Date(session.created_at).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Row header — clickable to expand */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
        aria-expanded={expanded}
      >
        {/* Expand icon (non-colour secondary signal per Rule 13) */}
        {expanded
          ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        }

        {/* Date */}
        <span className="w-40 shrink-0 text-sm text-muted-foreground font-mono tabular-nums">{date}</span>

        {/* Mode */}
        <ModeBadge mode={session.mode} />

        {/* Status (has icon for non-colour signal — Rule 13) */}
        <StatusBadge status={session.status} />

        {/* Order summary */}
        <span className="ml-auto text-xs text-muted-foreground">{orderSummary(session.orders)}</span>
      </button>

      {/* Expanded snapshot_before detail */}
      {expanded && (
        <div className="border-t border-border px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Snapshot at calculation time
          </p>
          <SnapshotDetail snapshot={snapshotBefore} />
        </div>
      )}
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function HistoryLoadingSkeleton() {
  return (
    <div className="space-y-2" aria-label="Loading history…">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function RebalanceHistoryView({ siloId, siloName }: Props) {
  const [page, setPage] = useState(1)
  const limit = 20

  const { data, isLoading, isError } = useQuery<HistoryResponse>({
    queryKey: ['rebalance-history', siloId, page],
    queryFn: async () => {
      const res = await fetch(
        `/api/silos/${siloId}/rebalance/history?page=${page}&limit=${limit}`,
      )
      if (!res.ok) throw new Error('Failed to load history')
      return res.json()
    },
  })

  const totalPages = data ? Math.ceil(data.total / limit) : 0

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Rebalance History</h1>
          <p className="text-sm text-muted-foreground mt-1">{siloName}</p>
        </div>
        <Link
          href={`/silos/${siloId}`}
          className="text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          ← Back to silo
        </Link>
      </div>

      {/* Loading */}
      {isLoading && <HistoryLoadingSkeleton />}

      {/* Error */}
      {isError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-negative bg-negative-bg px-4 py-3 text-sm text-negative"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          Failed to load rebalance history. Please refresh and try again.
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && data?.data.length === 0 && (
        <div className="rounded-lg border border-border bg-card px-6 py-12 text-center">
          <Clock className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-base font-medium text-foreground">No rebalancing sessions yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Run your first rebalance from the{' '}
            <Link
              href={`/silos/${siloId}/rebalance`}
              className="text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              rebalance page
            </Link>
            .
          </p>
        </div>
      )}

      {/* Session list */}
      {!isLoading && !isError && data && data.data.length > 0 && (
        <>
          <div className="space-y-2">
            {data.data.map((session) => (
              <SessionRow key={session.session_id} session={session} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, data.total)} of {data.total} sessions
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-md border border-border px-3 py-1 text-sm disabled:opacity-40 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-md border border-border px-3 py-1 text-sm disabled:opacity-40 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Regulatory disclaimer — Rule 14 */}
      <footer className="border-t border-border pt-4">
        <p className="text-xs text-muted-foreground text-center">
          This is not financial advice.
        </p>
      </footer>
    </div>
  )
}
