import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHoldingResponse, getHoldingsResponse } from '@/lib/holdingsApi'

type Params = Promise<{ silo_id: string }>

function unauthorized() {
  return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 })
}

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return unauthorized()
  const result = await getHoldingsResponse(_request, supabase, user.id, params)
  if (!result.ok) return result.response
  return NextResponse.json(result.data)
}

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return unauthorized()

  const result = await createHoldingResponse(request, supabase, user.id, params)
  if (!result.ok) return result.response
  return NextResponse.json(result.data, { status: result.status ?? 200 })
}
