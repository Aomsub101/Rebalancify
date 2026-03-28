'use client'

/**
 * SyncButton
 * Triggers POST /api/silos/:id/sync for API-connected silos (AC7).
 * Shows a spinner during the in-flight request.
 * Displays last_synced_at timestamp after completion.
 */
import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ErrorBanner } from '@/components/shared/ErrorBanner'

interface Props {
  siloId: string
  initialLastSyncedAt: string | null
  onSynced?: (syncedAt: string) => void
}

export function SyncButton({ siloId, initialLastSyncedAt, onSynced }: Props) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(initialLastSyncedAt)
  const [syncError, setSyncError] = useState<string | null>(null)

  async function handleSync() {
    setSyncError(null)
    setIsSyncing(true)
    try {
      const res = await fetch(`/api/silos/${siloId}/sync`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error?.message ?? 'Sync failed')
      }
      setLastSyncedAt(data.synced_at)
      onSynced?.(data.synced_at)
      toast.success(`Synced ${data.holdings_updated} holding${data.holdings_updated !== 1 ? 's' : ''}.`)
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed. Please try again.')
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleSync}
        disabled={isSyncing}
        aria-label="Sync holdings from broker"
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium',
          'border border-border bg-background text-foreground',
          'hover:bg-secondary transition-colors',
          'outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        <RefreshCw
          className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')}
          aria-hidden="true"
        />
        {isSyncing ? 'Syncing…' : 'Sync'}
      </button>

      {lastSyncedAt && !isSyncing && (
        <p className="text-[11px] text-muted-foreground">
          Last synced {new Date(lastSyncedAt).toLocaleString()}
        </p>
      )}

      {syncError && (
        <div className="mt-1 w-full">
          <ErrorBanner message={syncError} />
        </div>
      )}
    </div>
  )
}
