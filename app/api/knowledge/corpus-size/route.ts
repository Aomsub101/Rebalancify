import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 },
    )
  }

  const { data: sizeBytes, error: rpcError } = await supabase.rpc('get_corpus_size')

  if (rpcError) {
    console.error('[knowledge/corpus-size] RPC error:', rpcError)
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: 'Failed to fetch corpus size.' } },
      { status: 500 },
    )
  }

  return NextResponse.json({
    size_bytes: sizeBytes ?? 0,
  })
}
