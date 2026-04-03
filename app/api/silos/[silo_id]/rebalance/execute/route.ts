import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { executeRebalanceResponse } from '@/lib/rebalanceExecuteApi'

type Params = Promise<{ silo_id: string }>

function unauthorized() {
  return NextResponse.json(
    { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
    { status: 401 },
  )
}

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return unauthorized()

  const { silo_id } = await params
  const result = await executeRebalanceResponse(request, supabase, user.id, silo_id)

  if (!result.ok) return result.response
  return NextResponse.json(result.data, { status: result.status ?? 200 })
}
