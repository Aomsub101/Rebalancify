/**
 * POST /api/news/refresh
 *
 * Fetches news from Finnhub and FMP, deduplicates by external_id, and upserts
 * into news_cache. Returns the latest cached articles after the operation.
 *
 * AC-1: Fetches from Finnhub + FMP, deduplicates, upserts news_cache
 * AC-2: Finnhub 429 → stop Finnhub calls for this batch, return cache
 * AC-5: 15-min rate-limit guard — second call within 15 min returns cache with zero external calls
 * AC-6: Both sources unavailable → return last cached articles with original fetched_at
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createNewsClient } from '@/lib/newsQueryService'
import { fetchFinnhubNews, fetchFmpNews, deduplicateArticles, type NewsArticle } from '@/lib/newsService'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NewsRefreshRequest {
  tickers?: string[]
}

interface NewsCacheRow {
  id: string
  external_id: string
  source: string
  tickers: string[]
  headline: string
  summary: string | null
  url: string
  published_at: string | null
  is_macro: boolean
  fetched_at: string
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<NextResponse> {
  // Auth check — user-scoped client with Bearer token
  const bearerToken = request.headers.get('Authorization') ?? ''
  const supabase = createNewsClient(bearerToken)

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 })
  }

  // Parse optional body
  let tickers: string[] = []
  try {
    const body = (await request.json()) as NewsRefreshRequest
    if (Array.isArray(body.tickers)) {
      tickers = body.tickers.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    }
  } catch {
    // Body is optional — empty body is fine
  }

  // Use service-role client for writes (news_cache has no user-scoped RLS)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: { code: 'CONFIG_ERROR', message: 'News refresh service not configured' } },
      { status: 500 },
    )
  }

  const serviceClient = createClient(
    supabaseUrl,
    serviceRoleKey,
  )

  if (tickers.length === 0) {
    const { data: holdingsData } = await supabase
      .from('holdings')
      .select('assets!inner(ticker)')

    const seenTickers = new Set<string>()
    for (const row of holdingsData ?? []) {
      const assetsRaw = (row as { assets?: unknown }).assets
      const asset = Array.isArray(assetsRaw) ? assetsRaw[0] : assetsRaw
      const ticker = (asset as { ticker?: string } | null)?.ticker?.trim()
      if (ticker && !seenTickers.has(ticker)) {
        seenTickers.add(ticker)
        tickers.push(ticker)
      }
    }
  }

  // -------------------------------------------------------------------------
  // AC-5: 15-minute rate-limit guard (per-user in-memory)
  // -------------------------------------------------------------------------
  const globalAny = globalThis as any
  if (!globalAny.newsRateLimitMap) {
    globalAny.newsRateLimitMap = new Map<string, number>()
  }
  const lastFetch = globalAny.newsRateLimitMap.get(user.id) || 0
  const nowMs = Date.now()

  if (nowMs - lastFetch < 15 * 60 * 1000) {
    // Guard hit — return cached rows without any external API calls
    const { data: cached } = await serviceClient
      .from('news_cache')
      .select('*')
      .order('fetched_at', { ascending: false })
      .limit(100)

    return NextResponse.json({
      articles: cached ?? [],
      fromCache: true,
      guardHit: true,
    })
  }

  globalAny.newsRateLimitMap.set(user.id, nowMs)

  // -------------------------------------------------------------------------
  // Fetch from external sources
  // -------------------------------------------------------------------------
  const finnhubKey = process.env.FINNHUB_API_KEY ?? ''
  const fmpKey = process.env.FMP_API_KEY ?? ''

  // Fetch portfolio news (company-specific) and macro news in parallel
  const [finnhubPortfolio, finnhubMacro, fmpResult] = await Promise.all([
    tickers.length > 0 && finnhubKey
      ? fetchFinnhubNews(finnhubKey, tickers, false)
      : Promise.resolve({ articles: [], rateLimited: false, failed: false }),
    finnhubKey
      ? fetchFinnhubNews(finnhubKey, [], true)
      : Promise.resolve({ articles: [], rateLimited: false, failed: false }),
    fmpKey
      ? fetchFmpNews(fmpKey, tickers)
      : Promise.resolve({ articles: [], rateLimited: false, failed: false }),
  ])

  const rateLimited = finnhubPortfolio.rateLimited || finnhubMacro.rateLimited
  const allFailed =
    (finnhubPortfolio.failed || finnhubPortfolio.rateLimited) &&
    finnhubMacro.failed &&
    fmpResult.failed

  // AC-6: If both sources unavailable, return last cached articles
  if (allFailed) {
    const { data: fallback } = await serviceClient
      .from('news_cache')
      .select('*')
      .order('fetched_at', { ascending: false })
      .limit(100)

    return NextResponse.json({
      articles: fallback ?? [],
      fromCache: true,
      allSourcesFailed: true,
    })
  }

  // -------------------------------------------------------------------------
  // Deduplicate across sources and upsert
  // -------------------------------------------------------------------------
  const combined: NewsArticle[] = deduplicateArticles([
    ...finnhubPortfolio.articles,
    ...finnhubMacro.articles,
    ...fmpResult.articles,
  ])

  const now = new Date().toISOString()

  if (combined.length > 0) {
    const rows = combined.map((a) => ({
      external_id: a.externalId,
      source: a.source,
      tickers: a.tickers,
      headline: a.headline,
      summary: a.summary,
      url: a.url,
      published_at: a.publishedAt?.toISOString() ?? null,
      is_macro: a.isMacro,
      fetched_at: now,
    }))

    // ON CONFLICT on external_id: update headline/summary/tickers/fetched_at
    // (articles can be updated by source providers)
    await serviceClient.from('news_cache').upsert(rows, {
      onConflict: 'external_id',
      ignoreDuplicates: false,
    })
  }

  // Return all currently cached articles
  const { data: result } = await serviceClient
    .from('news_cache')
    .select('*')
    .order('fetched_at', { ascending: false })
    .limit(100)

  return NextResponse.json({
    articles: (result ?? []) as NewsCacheRow[],
    fromCache: false,
    rateLimited,
    newArticlesCount: combined.length,
  })
}
