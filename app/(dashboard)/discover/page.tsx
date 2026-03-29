'use client'

// Metadata is exported from app/(dashboard)/discover/layout.tsx
// (metadata cannot be exported from 'use client' components)

import { useState, useCallback } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { Search, Compass, BarChart2 } from 'lucide-react'
import { useSession } from '@/contexts/SessionContext'
import { TopMoversTable, type TopMoverItem } from '@/components/discover/TopMoversTable'
import { PeerCard, type PeerAsset } from '@/components/discover/PeerCard'
import { DriftBadge } from '@/components/shared/DriftBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorBanner } from '@/components/shared/ErrorBanner'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import type { DriftState } from '@/lib/drift'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TopMoversTab = 'stocks' | 'crypto'

interface TopMoversResponse {
  type: 'stocks' | 'crypto'
  stale: boolean
  fetched_at: string
  gainers: TopMoverItem[]
  losers: TopMoverItem[]
}

interface SearchResult {
  id: string | null
  ticker: string
  name: string
  asset_type: string
  current_price: string
}

interface DriftAsset {
  asset_id: string
  ticker: string
  current_weight_pct: number
  target_weight_pct: number
  drift_pct: number
  drift_state: DriftState
  drift_breached: boolean
}

interface DriftResponse {
  silo_id: string
  drift_threshold: number
  computed_at: string
  assets: DriftAsset[]
}

interface SiloSummary {
  id: string
  name: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const update = useCallback(
    (v: T) => {
      if (timer) clearTimeout(timer)
      const t = setTimeout(() => setDebounced(v), delayMs)
      setTimer(t)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [delayMs],
  )

  // When value changes externally, schedule debounce
  // We call update inline in the onChange handler instead
  return debounced
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DiscoverPage() {
  const { session } = useSession()

  const authHeaders: Record<string, string> = session
    ? { Authorization: `Bearer ${session.access_token}` }
    : {}

  // ---------------------------------------------------------------------------
  // Section 1: TopMoversTabs state
  // ---------------------------------------------------------------------------

  const [activeMoversTab, setActiveMoversTab] = useState<TopMoversTab>('stocks')

  // Pre-fetch both tabs to avoid loading flash on switch (same pattern as NewsPage)
  const {
    data: stocksData,
    isLoading: stocksLoading,
    isError: stocksError,
  } = useQuery<TopMoversResponse>({
    queryKey: ['top-movers', 'stocks'],
    queryFn: async () => {
      const res = await fetch('/api/market/top-movers?type=stocks', {
        headers: authHeaders,
      })
      if (!res.ok) throw new Error('Failed to fetch stock movers')
      return res.json()
    },
    enabled: !!session,
    staleTime: 5 * 60 * 1000, // 5 min — market data doesn't need per-second refresh
  })

  const {
    data: cryptoData,
    isLoading: cryptoLoading,
    isError: cryptoError,
  } = useQuery<TopMoversResponse>({
    queryKey: ['top-movers', 'crypto'],
    queryFn: async () => {
      const res = await fetch('/api/market/top-movers?type=crypto', {
        headers: authHeaders,
      })
      if (!res.ok) throw new Error('Failed to fetch crypto movers')
      return res.json()
    },
    enabled: !!session,
    staleTime: 5 * 60 * 1000,
  })

  const activeMoversData = activeMoversTab === 'stocks' ? stocksData : cryptoData
  const activeMoversLoading = activeMoversTab === 'stocks' ? stocksLoading : cryptoLoading
  const activeMoversError = activeMoversTab === 'stocks' ? stocksError : cryptoError

  // ---------------------------------------------------------------------------
  // Section 2: AssetPeerSearch state
  // ---------------------------------------------------------------------------

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<SearchResult | null>(null)

  function handleSearchChange(value: string) {
    setSearchInput(value)
    if (debounceTimer) clearTimeout(debounceTimer)
    if (!value.trim()) {
      setDebouncedSearch('')
      return
    }
    const t = setTimeout(() => setDebouncedSearch(value.trim()), 300)
    setDebounceTimer(t)
  }

  const {
    data: searchResults,
    isLoading: searchLoading,
    isError: searchError,
  } = useQuery<SearchResult[]>({
    queryKey: ['asset-search', debouncedSearch],
    queryFn: async () => {
      const res = await fetch(
        `/api/assets/search?q=${encodeURIComponent(debouncedSearch)}&type=stock`,
        { headers: authHeaders },
      )
      if (!res.ok) throw new Error('Search failed')
      return res.json()
    },
    enabled: !!session && debouncedSearch.length >= 1,
  })

  const {
    data: peersData,
    isLoading: peersLoading,
    isError: peersError,
  } = useQuery<PeerAsset[]>({
    queryKey: ['peers', selectedAsset?.id],
    queryFn: async () => {
      const res = await fetch(`/api/assets/${selectedAsset!.id}/peers`, {
        headers: authHeaders,
      })
      if (!res.ok) throw new Error('Failed to fetch peers')
      return res.json()
    },
    enabled: !!session && !!selectedAsset?.id,
  })

  function handleSelectAsset(asset: SearchResult) {
    setSelectedAsset(asset)
    setSearchInput(asset.ticker)
    setDebouncedSearch('')
  }

  // Dropdown is visible when search is active and no asset is selected yet
  const showDropdown =
    debouncedSearch.length >= 1 &&
    selectedAsset?.ticker !== searchInput &&
    !searchLoading &&
    (searchResults?.length ?? 0) > 0

  // ---------------------------------------------------------------------------
  // Section 3: PortfolioDriftSummary — fetch all silos, then drift per silo
  // ---------------------------------------------------------------------------

  const {
    data: silos,
    isLoading: silosLoading,
    isError: silosError,
  } = useQuery<SiloSummary[]>({
    queryKey: ['silos'],
    queryFn: async () => {
      const res = await fetch('/api/silos', { headers: authHeaders })
      if (!res.ok) throw new Error('Failed to fetch silos')
      const data = await res.json()
      // GET /api/silos returns full silo objects — we only need id + name here
      return (data as { id: string; name: string }[]).map((s) => ({
        id: s.id,
        name: s.name,
      }))
    },
    enabled: !!session,
  })

  const driftQueries = useQueries({
    queries: (silos ?? []).map((silo) => ({
      queryKey: ['drift', silo.id],
      queryFn: async (): Promise<DriftResponse> => {
        const res = await fetch(`/api/silos/${silo.id}/drift`, {
          headers: authHeaders,
        })
        if (!res.ok) throw new Error(`Failed to fetch drift for silo ${silo.id}`)
        return res.json()
      },
      enabled: !!session && (silos?.length ?? 0) > 0,
    })),
  })

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">
      {/* Disclaimer — CLAUDE.md Rule 14 */}
      <p className="text-xs text-muted-foreground">
        This is not financial advice.
      </p>

      {/* ================================================================
          Section 1 — TopMoversTabs (US Stocks | Crypto)
          AC-1, AC-2, AC-6
          ================================================================ */}
      <section aria-labelledby="movers-heading">
        <h2 id="movers-heading" className="text-xl font-medium text-foreground mb-4">
          Market Movers
        </h2>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Market mover categories"
          className="flex gap-1 border-b border-border mb-4"
        >
          {(
            [
              { id: 'stocks' as TopMoversTab, label: 'US Stocks' },
              { id: 'crypto' as TopMoversTab, label: 'Crypto' },
            ]
          ).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`movers-tab-${id}`}
              aria-selected={activeMoversTab === id}
              aria-controls={`movers-tabpanel-${id}`}
              onClick={() => setActiveMoversTab(id)}
              className={[
                'px-4 py-2 text-sm font-medium rounded-t-md transition-colors',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                activeMoversTab === id
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab panel */}
        <div
          role="tabpanel"
          id={`movers-tabpanel-${activeMoversTab}`}
          aria-labelledby={`movers-tab-${activeMoversTab}`}
        >
          <TopMoversTable
            gainers={activeMoversData?.gainers ?? []}
            losers={activeMoversData?.losers ?? []}
            stale={activeMoversData?.stale ?? false}
            isLoading={activeMoversLoading}
            isError={activeMoversError}
          />
        </div>
      </section>

      {/* ================================================================
          Section 2 — AssetPeerSearch
          AC-3, AC-4, AC-6
          ================================================================ */}
      <section aria-labelledby="peers-heading">
        <h2 id="peers-heading" className="text-xl font-medium text-foreground mb-4">
          Find Related Assets
        </h2>

        {/* Search input */}
        <div className="relative max-w-md">
          <label htmlFor="peer-search" className="sr-only">
            Search for a stock ticker to see related assets
          </label>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="peer-search"
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search ticker (e.g. NVDA)…"
              className={[
                'w-full pl-9 pr-4 py-2 rounded-md border border-border bg-card',
                'text-sm text-foreground placeholder:text-muted-foreground',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                'transition-colors',
              ].join(' ')}
              autoComplete="off"
              aria-autocomplete="list"
              aria-controls="peer-search-results"
              aria-expanded={showDropdown}
            />
          </div>

          {/* Search dropdown */}
          {showDropdown && (
            <ul
              id="peer-search-results"
              role="listbox"
              aria-label="Search results"
              className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
            >
              {searchResults!.map((result) => (
                <li key={result.ticker} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onClick={() => handleSelectAsset(result)}
                    className={[
                      'w-full text-left px-4 py-2.5 text-sm',
                      'hover:bg-secondary transition-colors',
                      'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                      result.id === null
                        ? 'opacity-60'
                        : '',
                    ].join(' ')}
                  >
                    <span className="font-mono font-medium text-foreground">{result.ticker}</span>
                    <span className="ml-2 text-muted-foreground truncate">{result.name}</span>
                    {result.id === null && (
                      <span className="ml-2 text-xs text-muted-foreground">(no peers)</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Loading state for search */}
          {searchLoading && debouncedSearch.length >= 1 && (
            <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg p-3">
              <LoadingSkeleton rows={3} />
            </div>
          )}

          {/* Search error */}
          {searchError && debouncedSearch.length >= 1 && (
            <div className="mt-2">
              <ErrorBanner message="Search unavailable. Please try again." />
            </div>
          )}
        </div>

        {/* Peer results grid */}
        <div className="mt-4">
          {selectedAsset && !selectedAsset.id && (
            <EmptyState
              icon={Compass}
              title="No peer data available"
              description={`${selectedAsset.ticker} is not yet tracked in Rebalancify. Add it to a silo first to enable peer discovery.`}
            />
          )}

          {selectedAsset?.id && peersLoading && (
            <LoadingSkeleton rows={4} />
          )}

          {selectedAsset?.id && peersError && (
            <ErrorBanner message="Failed to load peer assets. Please try again." />
          )}

          {selectedAsset?.id && !peersLoading && !peersError && (peersData?.length ?? 0) === 0 && (
            <EmptyState
              icon={Compass}
              title="No related assets found"
              description={`No peer assets found for ${selectedAsset.ticker}.`}
            />
          )}

          {selectedAsset?.id && !peersLoading && !peersError && (peersData?.length ?? 0) > 0 && (
            <div
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              aria-label={`Peer assets for ${selectedAsset.ticker}`}
            >
              {peersData!.map((peer) => (
                <PeerCard key={peer.ticker} peer={peer} />
              ))}
            </div>
          )}

          {!selectedAsset && debouncedSearch.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Search for a stock ticker above to see related assets.
            </p>
          )}
        </div>
      </section>

      {/* ================================================================
          Section 3 — PortfolioDriftSummary
          AC-5, AC-6
          ================================================================ */}
      <section aria-labelledby="drift-heading">
        <h2 id="drift-heading" className="text-xl font-medium text-foreground mb-4">
          Portfolio Drift Summary
        </h2>

        {silosLoading && <LoadingSkeleton rows={3} />}

        {silosError && (
          <ErrorBanner message="Failed to load portfolio drift. Please refresh." />
        )}

        {!silosLoading && !silosError && (silos?.length ?? 0) === 0 && (
          <EmptyState
            icon={BarChart2}
            title="No silos yet"
            description="Create a silo and add holdings to see your portfolio drift summary here."
          />
        )}

        {!silosLoading && !silosError && (silos?.length ?? 0) > 0 && (
          <div className="space-y-4">
            {(silos ?? []).map((silo, idx) => {
              const driftQuery = driftQueries[idx]

              return (
                <div
                  key={silo.id}
                  className="bg-card border border-border rounded-lg p-4"
                  aria-labelledby={`drift-silo-${silo.id}`}
                >
                  {/* SiloNameHeader */}
                  <h3
                    id={`drift-silo-${silo.id}`}
                    className="text-sm font-medium text-foreground mb-3"
                  >
                    {silo.name}
                  </h3>

                  {driftQuery.isLoading && <LoadingSkeleton rows={2} />}

                  {driftQuery.isError && (
                    <ErrorBanner message="Failed to load drift data for this silo." />
                  )}

                  {!driftQuery.isLoading &&
                    !driftQuery.isError &&
                    (driftQuery.data?.assets?.length ?? 0) === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No holdings in this silo.
                      </p>
                    )}

                  {!driftQuery.isLoading &&
                    !driftQuery.isError &&
                    (driftQuery.data?.assets?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {driftQuery.data!.assets.map((asset) => (
                          <div
                            key={asset.asset_id}
                            className="flex items-center gap-1.5"
                            aria-label={`${asset.ticker} drift`}
                          >
                            <span className="text-xs font-mono text-muted-foreground">
                              {asset.ticker}
                            </span>
                            <DriftBadge
                              driftPct={asset.drift_pct}
                              driftState={asset.drift_state}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
