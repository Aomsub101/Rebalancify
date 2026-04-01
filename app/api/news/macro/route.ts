/**
 * GET /api/news/macro
 *
 * Returns general macro news (is_macro = TRUE) with per-user read/dismissed state.
 *
 * AC-2: returns is_macro = TRUE articles
 * AC-3: is_read + is_dismissed state joined per user
 * AC-4: ?page=1&limit=20 pagination
 * AC-5: RLS on user_article_state ensures user-scoped state
 */

import { NextResponse } from 'next/server'
import { createNewsClient } from '@/lib/newsQueryService'
import { paginateArticles, type CachedArticle } from '@/lib/newsQueryService'

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
  const bearerToken = request.headers.get('Authorization') ?? ''
  const supabase = createNewsClient(bearerToken)

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
  // Fetch macro articles
  // news_cache is globally readable (RLS: SELECT USING(TRUE))
  // -------------------------------------------------------------------------
  const { data: rawArticles, error: articlesError } = await supabase
    .from('news_cache')
    .select('*')
    .eq('is_macro', true)
    .order('published_at', { ascending: false })
    .limit(500)

  if (articlesError) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: 'Failed to fetch macro news' } },
      { status: 500 }
    )
  }

  const articles = (rawArticles ?? []) as CachedArticle[]

  if (articles.length === 0) {
    return NextResponse.json({ data: [], page, limit, total: 0, hasMore: false })
  }

  // -------------------------------------------------------------------------
  // Fetch user_article_state for these articles
  // RLS on user_article_state ensures user B cannot see user A's state (AC-5)
  // -------------------------------------------------------------------------
  const articleIds = articles.map((a) => a.id)

  const { data: stateRows } = await supabase
    .from('user_article_state')
    .select('article_id, is_read, is_dismissed')
    .in('article_id', articleIds)

  const stateMap = new Map<string, { is_read: boolean; is_dismissed: boolean }>()
  for (const row of (stateRows ?? []) as ArticleStateRow[]) {
    stateMap.set(row.article_id, { is_read: row.is_read, is_dismissed: row.is_dismissed })
  }

  // Join state onto articles
  const withState = articles.map((a) => {
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
