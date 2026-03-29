/**
 * PATCH /api/news/articles/:article_id/state
 *
 * Writes per-user read/dismissed state for a news article.
 * Upserts into user_article_state (unique on user_id + article_id).
 *
 * AC-3: PATCH writes is_read or is_dismissed to user_article_state
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface StateBody {
  is_read?: boolean
  is_dismissed?: boolean
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ article_id: string }> }
): Promise<NextResponse> {
  const { article_id } = await params

  // Auth check
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

  // Parse body
  let body: StateBody
  try {
    body = (await request.json()) as StateBody
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'Request body must be valid JSON' } },
      { status: 400 }
    )
  }

  // At least one of is_read or is_dismissed must be present
  if (typeof body.is_read !== 'boolean' && typeof body.is_dismissed !== 'boolean') {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_BODY',
          message: 'Body must include at least one of: is_read (boolean), is_dismissed (boolean)',
        },
      },
      { status: 400 }
    )
  }

  // Verify the article exists in news_cache
  const { data: article, error: articleError } = await supabase
    .from('news_cache')
    .select('id')
    .eq('id', article_id)
    .maybeSingle()

  if (articleError || !article) {
    return NextResponse.json(
      { error: { code: 'ARTICLE_NOT_FOUND', message: 'Article not found' } },
      { status: 404 }
    )
  }

  // Build upsert payload — only include fields explicitly set
  const upsertPayload: Record<string, unknown> = {
    user_id: user.id,
    article_id,
    interacted_at: new Date().toISOString(),
  }
  if (typeof body.is_read === 'boolean') upsertPayload.is_read = body.is_read
  if (typeof body.is_dismissed === 'boolean') upsertPayload.is_dismissed = body.is_dismissed

  const { error: upsertError } = await supabase
    .from('user_article_state')
    .upsert(upsertPayload, { onConflict: 'user_id,article_id' })

  if (upsertError) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: 'Failed to save article state' } },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
