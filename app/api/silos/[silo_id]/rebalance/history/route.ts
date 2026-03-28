/**
 * GET /api/silos/:silo_id/rebalance/history
 *
 * Returns a paginated list of rebalancing sessions for a single silo.
 * Sessions are ordered newest first (AC4).
 * Each session includes its orders with execution_status (AC1).
 *
 * Query params:
 *   page  (default 1)
 *   limit (default 20)
 *
 * RLS: Supabase policy rebal_sessions_owner (user_id = auth.uid()) enforces
 * that user B cannot see user A's sessions (AC6). The explicit user_id filter
 * is an extra application-layer guard per the security testing strategy.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = Promise<{ silo_id: string }>

function unauthorized() {
  return NextResponse.json(
    { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
    { status: 401 },
  )
}

function notFound() {
  return NextResponse.json(
    { error: { code: 'NOT_FOUND', message: 'Silo not found' } },
    { status: 404 },
  )
}

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return unauthorized()

  const { silo_id } = await params

  // -------------------------------------------------------------------------
  // Verify silo ownership (RLS double-check per testing strategy)
  // -------------------------------------------------------------------------

  const { data: silo } = await supabase
    .from('silos')
    .select('id')
    .eq('id', silo_id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!silo) return notFound()

  // -------------------------------------------------------------------------
  // Parse pagination params
  // -------------------------------------------------------------------------

  const searchParams = new URL(request.url).searchParams
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20))
  const from = (page - 1) * limit
  const to = from + limit - 1

  // -------------------------------------------------------------------------
  // Fetch sessions with orders, newest first (AC1, AC4)
  // -------------------------------------------------------------------------

  const { data: sessions, error: sessionsError, count } = await supabase
    .from('rebalance_sessions')
    .select('id, mode, created_at, status, snapshot_before, rebalance_orders(id, execution_status)', { count: 'exact' })
    .eq('silo_id', silo_id)
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
  // Map to response shape (AC1: session_id, mode, created_at, status, orders)
  // -------------------------------------------------------------------------

  const data = (sessions ?? []).map((s) => ({
    session_id: s.id,
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
