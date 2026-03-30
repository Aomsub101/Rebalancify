/**
 * POST /api/llm/validate
 * Validates an LLM API key by making a lightweight request to the provider.
 * Called client-side before saving to give the user immediate feedback.
 * SECURITY: Key is received over HTTPS, tested server-side, never logged or stored.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ValidateBody {
  provider: string
  key: string
}

/**
 * Makes a minimal API call to validate the key. Returns true if valid, false otherwise.
 * Uses model-list endpoints (no tokens consumed) except Anthropic (1-token message).
 */
async function pingProvider(provider: string, key: string): Promise<boolean> {
  try {
    switch (provider) {
      case 'google': {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(key)}`,
          { signal: AbortSignal.timeout(8000) },
        )
        return res.ok
      }
      case 'groq': {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(8000),
        })
        return res.ok
      }
      case 'deepseek': {
        const res = await fetch('https://api.deepseek.com/models', {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(8000),
        })
        return res.ok
      }
      case 'openai': {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(8000),
        })
        return res.ok
      }
      case 'anthropic': {
        // Anthropic has no models list; use a minimal 1-token message instead
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hi' }],
          }),
          signal: AbortSignal.timeout(15000),
        })
        return res.ok
      }
      case 'openrouter': {
        const res = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(8000),
        })
        return res.ok
      }
      default:
        return false
    }
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 },
    )
  }

  let body: ValidateBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'Invalid request body' } },
      { status: 400 },
    )
  }

  const { provider, key } = body
  if (!provider || !key) {
    return NextResponse.json(
      { error: { code: 'MISSING_FIELDS', message: 'provider and key are required' } },
      { status: 400 },
    )
  }

  const valid = await pingProvider(provider, key)
  return NextResponse.json({ valid })
}
