import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

function sanitizeNext(next: string | null): string {
  if (!next || !next.startsWith('/')) return '/overview'
  if (next.startsWith('//')) return '/overview'
  return next
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')
  const next = sanitizeNext(url.searchParams.get('next'))
  const errorRedirect = new URL('/login', url.origin)

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin))
    }
    errorRedirect.searchParams.set('error', error.message)
    return NextResponse.redirect(errorRedirect)
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    })
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin))
    }
    errorRedirect.searchParams.set('error', error.message)
    return NextResponse.redirect(errorRedirect)
  }

  errorRedirect.searchParams.set('error', 'Invalid or expired confirmation link')
  return NextResponse.redirect(errorRedirect)
}
