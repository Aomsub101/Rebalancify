'use client'

/**
 * SyncButton
 * Triggers POST /api/silos/:id/sync for API-connected silos (AC7).
 * Shows a spinner during the in-flight request.
 * Displays last_synced_at timestamp after completion.
 * Disabled with tooltip when offline (STORY-027 AC-5).
 */
import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ErrorBanner } from '@/components/shared/ErrorBanner'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

interface Props {
  siloId: string
  initialLastSyncedAt: string | null
  onSynced?: (syncedAt: string) => void
}

export function SyncButton({ siloId, initialLastSyncedAt, onSynced }: Props) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(initialLastSyncedAt)
  const [syncError, setSyncError] = useState<string | null>(null)
  const { isOnline } = useOnlineStatus()

  async function handleSync() {
    if (!isOnline) return
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

  const isDisabled = isSyncing || !isOnline

  return (
    <div className="flex flex-col items-end gap-1">
      {/* Tooltip wrapper for offline state (AC-5) — span wrapper makes disabled button hoverable */}
      <div className="relative group">
        <span className={cn(!isOnline && 'cursor-not-allowed')}>
          <button
            onClick={handleSync}
            disabled={isDisabled}
            aria-label={isOnline ? 'Sync holdings from broker' : 'Unavailable offline'}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium',
              'border border-border bg-background text-foreground',
              'hover:bg-secondary transition-colors',
              'outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              !isOnline && 'pointer-events-none',
            )}
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')}
              aria-hidden="true"
            />
            {isSyncing ? 'Syncing…' : 'Sync'}
          </button>
        </span>
        {/* Offline tooltip */}
        {!isOnline && (
          <div
            role="tooltip"
            className="absolute right-0 top-full mt-1 w-max rounded-md bg-popover border border-border px-2.5 py-1.5 text-xs text-muted-foreground shadow-md hidden group-hover:block pointer-events-none"
          >
            Unavailable offline
          </div>
        )}
      </div>

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
