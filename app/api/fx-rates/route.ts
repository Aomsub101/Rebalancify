import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureFxRates } from '@/lib/fxRates'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 },
    )
  }

  const { data: siloRows } = await supabase
    .from('silos')
    .select('base_currency')
    .eq('user_id', user.id)
    .eq('is_active', true)

  const currencies = Array.from(
    new Set([
      'USD',
      ...(siloRows ?? []).map((row: { base_currency: string }) => row.base_currency),
    ]),
  )

  const result = await ensureFxRates(supabase, currencies)
  return NextResponse.json(result)
}
