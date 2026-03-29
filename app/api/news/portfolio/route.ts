/**
 * GET /api/news/portfolio
 *
 * Returns news articles relevant to the user's holdings using two-tier matching:
 *
 * Tier 1 — articles whose tickers array overlaps the user's holding tickers
 *           (backed by GIN index news_tickers_gin on news_cache.tickers)
 * Tier 2 — articles NOT in tier-1 whose metadata.related_tickers overlaps
 *           the user's holding tickers
 *
 * Each article includes is_read and is_dismissed from user_article_state.
 *
 * AC-1: two-tier matching, dedup, tier-1 ranked first
 * AC-3: is_read + is_dismissed state joined per user
 * AC-4: ?page=1&limit=20 pagination
 * AC-5: RLS on user_article_state ensures user-scoped state
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { splitIntoTiers, mergeAndRankArticles, paginateArticles, type CachedArticle } from '@/lib/newsQueryService'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ArticleStateRow {
  article_id: string
  is_read: boolean
  is_dismissed: boolean
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(request: Request): Promise<NextResponse> {
  // Auth check — user-scoped client (RLS enforced)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: request.headers.get('Authorization') ?? '' },
      },
    }
  )

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  // Parse pagination params
  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10) || 20))

  // -------------------------------------------------------------------------
  // Step 1: Get user's holding tickers across all silos
  // -------------------------------------------------------------------------
  const { data: holdingsData, error: holdingsError } = await supabase
    .from('holdings')
    .select('asset_id, silos!inner(user_id), assets!inner(ticker)')

  if (holdingsError) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: 'Failed to fetch holdings' } },
      { status: 500 }
    )
  }

  // Extract unique tickers (RLS on holdings ensures user_id = auth.uid())
  // Supabase returns joined tables as arrays for !inner joins; handle both shapes.
  const userTickers: string[] = []
  const seenTickers = new Set<string>()
  for (const row of holdingsData ?? []) {
    const assetsRaw = row.assets as unknown
    const assetsObj = Array.isArray(assetsRaw) ? assetsRaw[0] : assetsRaw
    const ticker = (assetsObj as { ticker?: string } | null)?.ticker
    if (ticker && !seenTickers.has(ticker)) {
      seenTickers.add(ticker)
      userTickers.push(ticker)
    }
  }

  // No holdings → return empty result
  if (userTickers.length === 0) {
    return NextResponse.json({ data: [], page, limit, total: 0, hasMore: false })
  }

  // -------------------------------------------------------------------------
  // Step 2: Fetch all non-macro articles from news_cache
  // news_cache is globally readable (RLS: SELECT USING(TRUE))
  // Bounded by 24-hour TTL + pg_cron purge job — typically a few hundred rows
  // -------------------------------------------------------------------------
  const { data: rawArticles, error: articlesError } = await supabase
    .from('news_cache')
    .select('*')
    .eq('is_macro', false)
    .order('published_at', { ascending: false })
    .limit(500)

  if (articlesError) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: 'Failed to fetch news articles' } },
      { status: 500 }
    )
  }

  const articles = (rawArticles ?? []) as CachedArticle[]

  // -------------------------------------------------------------------------
  // Step 3: Two-tier matching + ranking
  // -------------------------------------------------------------------------
  const { tier1, tier2 } = splitIntoTiers(articles, userTickers)
  const ranked = mergeAndRankArticles(tier1, tier2)

  if (ranked.length === 0) {
    return NextResponse.json({ data: [], page, limit, total: 0, hasMore: false })
  }

  // -------------------------------------------------------------------------
  // Step 4: Fetch user_article_state for the matched articles
  // RLS on user_article_state ensures user B cannot see user A's state (AC-5)
  // -------------------------------------------------------------------------
  const articleIds = ranked.map((a) => a.id)

  const { data: stateRows } = await supabase
    .from('user_article_state')
    .select('article_id, is_read, is_dismissed')
    .in('article_id', articleIds)

  const stateMap = new Map<string, { is_read: boolean; is_dismissed: boolean }>()
  for (const row of (stateRows ?? []) as ArticleStateRow[]) {
    stateMap.set(row.article_id, { is_read: row.is_read, is_dismissed: row.is_dismissed })
  }

  // -------------------------------------------------------------------------
  // Step 5: Join state + paginate
  // -------------------------------------------------------------------------
  const withState = ranked.map((a) => {
    const state = stateMap.get(a.id)
    return {
      ...a,
      is_read: state?.is_read ?? false,
      is_dismissed: state?.is_dismissed ?? false,
    }
  })

  const { items, total, hasMore } = paginateArticles(withState, page, limit)

  return NextResponse.json({ data: items, page, limit, total, hasMore })
}
