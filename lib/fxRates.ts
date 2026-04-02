import { createClient as createSupabaseClient } from '@supabase/supabase-js'

interface ExchangeRateApiResponse {
  result: string
  'error-type'?: string
  conversion_rates?: Record<string, number>
}

export interface FxRateRow {
  currency: string
  rate_to_usd: string
  fetched_at: string
}

export function parseExchangeRates(data: unknown): Record<string, number> {
  if (typeof data !== 'object' || data === null) {
    throw new Error('ExchangeRate-API returned unexpected data type')
  }

  const body = data as ExchangeRateApiResponse

  if (body.result !== 'success') {
    throw new Error(`ExchangeRate-API error: ${body['error-type'] ?? 'unknown'}`)
  }

  if (!body.conversion_rates || typeof body.conversion_rates !== 'object') {
    throw new Error('ExchangeRate-API returned no conversion_rates')
  }

  return body.conversion_rates
}

export function rateToUsd(currency: string, rates: Record<string, number>): string {
  const rateFromUsd = rates[currency]
  if (rateFromUsd === undefined) {
    throw new Error(`Currency ${currency} not found in exchange rates`)
  }

  return (1 / rateFromUsd).toFixed(8)
}

export function isFxRateStale(row: FxRateRow, ttlMinutes = 60): boolean {
  const ageMs = Date.now() - new Date(row.fetched_at).getTime()
  return ageMs > ttlMinutes * 60 * 1000
}

function toResultMap(rows: FxRateRow[]): Record<string, { rate_to_usd: string; fetched_at: string }> {
  const result: Record<string, { rate_to_usd: string; fetched_at: string }> = {}
  for (const row of rows) {
    result[row.currency] = { rate_to_usd: row.rate_to_usd, fetched_at: row.fetched_at }
  }
  return result
}

export async function ensureFxRates(
  supabase: { from: (table: string) => unknown },
  requestedCurrencies: string[],
  ttlMinutes = 60,
): Promise<Record<string, { rate_to_usd: string; fetched_at: string }>> {
  const normalizedRequested = requestedCurrencies.filter(
    (currency): currency is string => typeof currency === 'string' && currency.trim().length > 0,
  )
  const currencies = Array.from(
    new Set(['USD', ...normalizedRequested.map((currency) => currency.toUpperCase())]),
  )

  const fxTable = supabase.from('fx_rates') as {
    select?: (columns: string) => { in: (column: string, values: string[]) => PromiseLike<{ data: FxRateRow[] | null; error?: unknown }> }
    upsert?: (
      rows: Array<{ currency: string; rate_to_usd: string; fetched_at: string }>,
      options: { onConflict: string },
    ) => PromiseLike<{ error?: unknown }>
  } | undefined

  if (!fxTable?.select) {
    return {
      USD: {
        rate_to_usd: '1.00000000',
        fetched_at: new Date(0).toISOString(),
      },
    }
  }

  const { data: cachedRows, error: readError } = await fxTable
    .select('currency, rate_to_usd, fetched_at')
    .in('currency', currencies)

  const cached = readError ? [] : (cachedRows ?? [])
  const cachedMap = new Map(cached.map((row) => [row.currency, row]))
  const needsRefresh =
    currencies.some((currency) => !cachedMap.has(currency)) ||
    cached.some((row) => isFxRateStale(row, ttlMinutes))

  if (!needsRefresh) {
    return toResultMap(cached)
  }

  const apiKey = process.env.EXCHANGERATE_API_KEY
  if (!apiKey) {
    return toResultMap(cached)
  }

  try {
    const response = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`)
    const json = await response.json()
    const rates = parseExchangeRates(json)

    const now = new Date().toISOString()
    const rows = currencies.map((currency) => ({
      currency,
      rate_to_usd: rateToUsd(currency, rates),
      fetched_at: now,
    }))

    let writeError: unknown = null
    if (fxTable.upsert) {
      const result = await fxTable.upsert(rows, { onConflict: 'currency' })
      writeError = result?.error
    }

    if (writeError) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (url && serviceRoleKey) {
        const serviceClient = createSupabaseClient(url, serviceRoleKey)
        await serviceClient.from('fx_rates').upsert(rows, { onConflict: 'currency' })
      }
    }

    return toResultMap(rows)
  } catch {
    console.error('[fx-rates] ExchangeRate-API unavailable - using cached rates')
    return toResultMap(cached)
  }
}
