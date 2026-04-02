import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('signed_out', '1')
  return NextResponse.redirect(loginUrl)
}
