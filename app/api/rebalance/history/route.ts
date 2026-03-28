/**
 * GET /api/rebalance/history
 *
 * Returns a paginated list of rebalancing sessions across ALL of the
 * authenticated user's silos. Each session includes silo_name and silo_id (AC2).
 * Sessions are ordered newest first (AC4).
 *
 * Query params:
 *   page  (default 1)
 *   limit (default 20)
 *
 * RLS: Supabase policy rebal_sessions_owner (user_id = auth.uid()) enforces
 * that user B cannot see user A's sessions (AC6).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function unauthorized() {
  return NextResponse.json(
    { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
    { status: 401 },
  )
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return unauthorized()

  // -------------------------------------------------------------------------
  // Parse pagination params
  // -------------------------------------------------------------------------

  const searchParams = new URL(request.url).searchParams
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20))
  const from = (page - 1) * limit
  const to = from + limit - 1

  // -------------------------------------------------------------------------
  // Fetch sessions across all silos with silo name, newest first (AC2, AC4)
  // -------------------------------------------------------------------------

  const { data: sessions, error: sessionsError, count } = await supabase
    .from('rebalance_sessions')
    .select(
      'id, silo_id, mode, created_at, status, snapshot_before, rebalance_orders(id, execution_status), silos(name)',
      { count: 'exact' },
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (sessionsError) {
    return NextResponse.json(
      { error: { code: 'FETCH_FAILED', message: sessionsError.message } },
      { status: 500 },
    )
  }

  // -------------------------------------------------------------------------
  // Map to response shape (AC2: session_id, silo_id, silo_name, mode, etc.)
  // -------------------------------------------------------------------------

  const data = (sessions ?? []).map((s) => ({
    session_id: s.id,
    silo_id: s.silo_id,
    silo_name: Array.isArray(s.silos) ? (s.silos[0] as { name: string } | undefined)?.name ?? null : (s.silos as { name: string } | null)?.name ?? null,
    mode: s.mode,
    created_at: s.created_at,
    status: s.status,
    snapshot_before: s.snapshot_before ?? null,
    orders: (s.rebalance_orders ?? []).map((o: { id: string; execution_status: string }) => ({
      id: o.id,
      execution_status: o.execution_status,
    })),
  }))

  return NextResponse.json({
    data,
    page,
    limit,
    total: count ?? 0,
  })
}
