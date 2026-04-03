'use client'

// Metadata is exported from app/(dashboard)/news/layout.tsx
// (metadata cannot be exported from 'use client' components)

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { RefreshCw, Newspaper, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { ArticleCard, type Article } from '@/components/news/ArticleCard'
import { RateLimitBanner } from '@/components/news/RateLimitBanner'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorBanner } from '@/components/shared/ErrorBanner'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'portfolio' | 'macro'

interface NewsResponse {
  data: Article[]
  page: number
  limit: number
  total: number
  hasMore: boolean
}

interface RefreshResponse {
  rateLimited?: boolean
  guardHit?: boolean
  fromCache?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a human-readable relative time for the RefreshBar "Last updated" label.
 * Accepts an ISO date string or null.
 */
function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  return `${diffDays}d ago`
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewsPage() {
  const { session } = useAuth()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<Tab>('portfolio')
  const [portfolioPage, setPortfolioPage] = useState(1)
  const [macroPage, setMacroPage] = useState(1)
  const [rateLimited, setRateLimited] = useState(false)

  const authHeaders: Record<string, string> = session
    ? { Authorization: `Bearer ${session.access_token}` }
    : {}

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  const {
    data: portfolioData,
    isLoading: portfolioLoading,
    isError: portfolioError,
  } = useQuery<NewsResponse>({
    queryKey: ['news', 'portfolio', portfolioPage],
    queryFn: async () => {
      const res = await fetch(`/api/news/portfolio?page=${portfolioPage}&limit=20`, {
        headers: authHeaders,
      })
      if (!res.ok) throw new Error('Failed to fetch portfolio news')
      return res.json()
    },
    enabled: !!session,
  })

  const {
    data: macroData,
    isLoading: macroLoading,
    isError: macroError,
  } = useQuery<NewsResponse>({
    queryKey: ['news', 'macro', macroPage],
    queryFn: async () => {
      const res = await fetch(`/api/news/macro?page=${macroPage}&limit=20`, {
        headers: authHeaders,
      })
      if (!res.ok) throw new Error('Failed to fetch macro news')
      return res.json()
    },
    enabled: !!session,
  })

  // ---------------------------------------------------------------------------
  // Refresh mutation (POST /api/news/refresh)
  // ---------------------------------------------------------------------------

  const refreshMutation = useMutation<RefreshResponse>({
    mutationFn: async () => {
      const res = await fetch('/api/news/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error('Refresh failed')
      return res.json()
    },
    onSuccess: (data) => {
      if (data.rateLimited || data.guardHit) {
        setRateLimited(true)
      } else {
        setRateLimited(false)
      }
      // Invalidate both tabs — the cache is now refreshed
      queryClient.invalidateQueries({ queryKey: ['news', 'portfolio'] })
      queryClient.invalidateQueries({ queryKey: ['news', 'macro'] })
      toast.success('News refreshed')
    },
    onError: () => {
      toast.error('Failed to refresh news')
    },
  })

  // ---------------------------------------------------------------------------
  // Article state mutation (PATCH /api/news/articles/:id/state)
  // Optimistic update: set is_read / is_dismissed on the article in the cache.
  // ---------------------------------------------------------------------------

  const stateMutation = useMutation<
    unknown,
    Error,
    { articleId: string; payload: { is_read?: boolean; is_dismissed?: boolean } }
  >({
    mutationFn: async ({ articleId, payload }) => {
      const res = await fetch(`/api/news/articles/${articleId}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to update article state')
      return res.json()
    },
    onMutate: async ({ articleId, payload }) => {
      // Cancel any in-flight refetches so they don't overwrite the optimistic update
      await queryClient.cancelQueries({ queryKey: ['news'] })

      // Snapshot both caches for potential rollback
      const portfolioSnapshot = queryClient.getQueryData<NewsResponse>([
        'news',
        'portfolio',
        portfolioPage,
      ])
      const macroSnapshot = queryClient.getQueryData<NewsResponse>([
        'news',
        'macro',
        macroPage,
      ])

      // Optimistically update the article's state in both caches
      const updateCache = (old: NewsResponse | undefined) => {
        if (!old) return old
        return {
          ...old,
          data: old.data.map((a) =>
            a.id === articleId ? { ...a, ...payload } : a
          ),
        }
      }

      queryClient.setQueryData<NewsResponse>(
        ['news', 'portfolio', portfolioPage],
        updateCache
      )
      queryClient.setQueryData<NewsResponse>(
        ['news', 'macro', macroPage],
        updateCache
      )

      return { portfolioSnapshot, macroSnapshot }
    },
    onError: (_err, _vars, context) => {
      // Rollback on failure
      const ctx = context as
        | { portfolioSnapshot?: NewsResponse; macroSnapshot?: NewsResponse }
        | undefined
      if (ctx?.portfolioSnapshot) {
        queryClient.setQueryData(
          ['news', 'portfolio', portfolioPage],
          ctx.portfolioSnapshot
        )
      }
      if (ctx?.macroSnapshot) {
        queryClient.setQueryData(
          ['news', 'macro', macroPage],
          ctx.macroSnapshot
        )
      }
      toast.error('Failed to update article')
    },
  })

  // ---------------------------------------------------------------------------
  // Derived data for the active tab
  // Filter out articles that are read or dismissed — they are no longer "active"
  // ---------------------------------------------------------------------------

  const activeData = activeTab === 'portfolio' ? portfolioData : macroData
  const isLoading = activeTab === 'portfolio' ? portfolioLoading : macroLoading
  const isError = activeTab === 'portfolio' ? portfolioError : macroError
  const currentPage = activeTab === 'portfolio' ? portfolioPage : macroPage
  const setCurrentPage = activeTab === 'portfolio' ? setPortfolioPage : setMacroPage

  const visibleArticles = (activeData?.data ?? []).filter(
    (a) => !a.is_read && !a.is_dismissed
  )

  // Last updated time — use fetched_at of the most recent article (all have the same batch fetched_at)
  const lastUpdated = activeData?.data?.[0]
    ? (activeData.data[0] as Article & { fetched_at?: string }).fetched_at
    : undefined

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
      {/* Disclaimer — CLAUDE.md Rule 14 */}
      <p className="text-xs text-muted-foreground">
        This is not financial advice.
      </p>

      {/* Tabs — AC-1 */}
      <div
        role="tablist"
        aria-label="News categories"
        className="flex gap-1 border-b border-border"
      >
        {(
          [
            { id: 'portfolio', label: 'Portfolio News' },
            { id: 'macro', label: 'Macro News' },
          ] as { id: Tab; label: string }[]
        ).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={activeTab === id}
            aria-controls={`tabpanel-${id}`}
            onClick={() => setActiveTab(id)}
            className={[
              'px-4 py-2 text-sm font-medium rounded-t-md transition-colors',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              activeTab === id
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* RefreshBar — AC-1 */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Last updated{' '}
          <time
            dateTime={lastUpdated ?? ''}
            aria-label={`Last updated ${formatRelativeTime(lastUpdated)}`}
          >
            {formatRelativeTime(lastUpdated)}
          </time>
        </span>
        <button
          type="button"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          aria-label="Refresh news"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm font-medium text-foreground hover:bg-secondary transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw
            className={['h-3.5 w-3.5', refreshMutation.isPending ? 'animate-spin' : ''].join(' ')}
            aria-hidden="true"
          />
          {refreshMutation.isPending ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Rate limit banner — AC-3 */}
      <RateLimitBanner
        visible={rateLimited}
        onDismiss={() => setRateLimited(false)}
      />

      {/* Tab panel */}
      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {isLoading && <LoadingSkeleton rows={5} />}

        {isError && (
          <ErrorBanner message="Failed to load news. Please try refreshing." />
        )}

        {!isLoading && !isError && visibleArticles.length === 0 && (
          <EmptyState
            icon={Newspaper}
            title={
              activeTab === 'portfolio'
                ? 'No portfolio news'
                : 'No macro news'
            }
            description={
              activeTab === 'portfolio'
                ? 'No recent articles matching your holdings. Try refreshing or add more assets.'
                : 'No recent macro news. Try refreshing.'
            }
          />
        )}

        {!isLoading && !isError && visibleArticles.length > 0 && (
          <div className="space-y-3">
            {visibleArticles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                onMarkRead={(id) =>
                  stateMutation.mutate({ articleId: id, payload: { is_read: true } })
                }
                onDismiss={(id) =>
                  stateMutation.mutate({ articleId: id, payload: { is_dismissed: true } })
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination controls */}
      {!isLoading && !isError && (activeData?.total ?? 0) > 20 && (
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            aria-label="Previous page"
            className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-sm text-foreground hover:bg-secondary transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Previous
          </button>
          <span className="text-xs text-muted-foreground">
            Page {currentPage}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={!activeData?.hasMore}
            aria-label="Next page"
            className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-border text-sm text-foreground hover:bg-secondary transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}
