/**
 * GET /api/fx-rates
 * Returns cached FX rates with 60-minute TTL.
 * Re-fetches from ExchangeRate-API when stale; falls back to cached on API failure.
 *
 * Response: { [currency]: { rate_to_usd: string, fetched_at: string } }
 *
 * AC-1: Returns { [currency]: { rate_to_usd, fetched_at } }
 * AC-2: No ExchangeRate-API call when all rates are fresh (< 60 min)
 * AC-3: Calls ExchangeRate-API and upserts when stale
 * AC-4: Returns cached rates on API failure — does not error
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseExchangeRates, rateToUsd } from '@/lib/fxRates'

const TTL_MINUTES = 60

interface FxRateRow {
  currency: string
  rate_to_usd: string
  fetched_at: string
}

function isStale(row: FxRateRow): boolean {
  const ageMs = Date.now() - new Date(row.fetched_at).getTime()
  return ageMs > TTL_MINUTES * 60 * 1000
}

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 },
    )
  }

  // Determine which currencies this user's silos need
  const { data: siloRows } = await supabase
    .from('silos')
    .select('base_currency')
    .eq('user_id', user.id)
    .eq('is_active', true)

  const currencies = Array.from(
    new Set([
      'USD',
      ...(siloRows ?? []).map((r: { base_currency: string }) => r.base_currency),
    ]),
  )

  // Read cached rates for those currencies
  const { data: cachedRows, error: readError } = await supabase
    .from('fx_rates')
    .select('currency, rate_to_usd, fetched_at')
    .in('currency', currencies)

  const cached: FxRateRow[] = readError ? [] : (cachedRows ?? [])

  // Check if any currency is missing or stale
  const cachedMap = new Map(cached.map((r) => [r.currency, r]))
  const needsRefresh =
    currencies.some((c) => !cachedMap.has(c)) ||
    cached.some((r) => isStale(r))

  if (needsRefresh) {
    const apiKey = process.env.EXCHANGERATE_API_KEY
    if (apiKey) {
      try {
        const response = await fetch(
          `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`,
        )
        const json = await response.json()
        const rates = parseExchangeRates(json)

        const now = new Date().toISOString()
        const upsertRows = currencies.map((currency) => ({
          currency,
          rate_to_usd: rateToUsd(currency, rates),
          fetched_at: now,
        }))

        await supabase.from('fx_rates').upsert(upsertRows, { onConflict: 'currency' })

        // Return the freshly computed rates (don't re-query — avoid extra round-trip)
        const result: Record<string, { rate_to_usd: string; fetched_at: string }> = {}
        for (const row of upsertRows) {
          result[row.currency] = { rate_to_usd: row.rate_to_usd, fetched_at: row.fetched_at }
        }
        return NextResponse.json(result)
      } catch {
        // AC-4: ExchangeRate-API unavailable — fall through to return cached rates
        // Log for observability but do not surface the error to the client
        console.error('[fx-rates] ExchangeRate-API unavailable — using cached rates')
      }
    }
  }

  // Return cached rates (either fresh, or fallback after API failure)
  const result: Record<string, { rate_to_usd: string; fetched_at: string }> = {}
  for (const row of cached) {
    result[row.currency] = { rate_to_usd: row.rate_to_usd, fetched_at: row.fetched_at }
  }
  return NextResponse.json(result)
}
