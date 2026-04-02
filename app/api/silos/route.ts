import { NextResponse } from 'next/server'
import Decimal from 'decimal.js'
import { createClient } from '@/lib/supabase/server'
import { checkSiloLimit, buildSiloResponse } from '@/lib/silos'
import { fetchPrice } from '@/lib/priceService'
import { cashCurrencyForPlatform, convertAmount } from '@/lib/currency'
import { ensureFxRates } from '@/lib/fxRates'

const VALID_PLATFORM_TYPES = ['alpaca', 'bitkub', 'innovestx', 'schwab', 'webull', 'manual'] as const

async function computeSiloTotalValue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  silo: { id: string; cash_balance: string; base_currency: string; platform_type: string }
): Promise<string> {
  const { data: holdingsData } = await supabase
    .from('holdings')
    .select('asset_id, quantity, assets!inner(ticker, price_source)')
    .eq('silo_id', silo.id)

  const rows = holdingsData ?? []
  if (rows.length === 0) {
    return silo.cash_balance ?? '0'
  }

  const assetIds = rows.map(h => h.asset_id)

  const { data: priceData } = await supabase
    .from('price_cache')
    .select('asset_id, price, currency')
    .in('asset_id', assetIds)

  const priceMap = new Map((priceData ?? []).map(p => [p.asset_id, {
    price: p.price as string,
    currency: (p.currency as string | null) ?? 'USD',
  }]))

  const currencies = new Set<string>([silo.base_currency, cashCurrencyForPlatform(silo.platform_type, silo.base_currency)])
  for (const priceRow of priceData ?? []) {
    currencies.add((priceRow.currency as string | null) ?? 'USD')
  }

  for (const row of rows) {
    const existing = priceMap.get(row.asset_id)
    if (existing && existing.price !== '0') continue
    const assetRaw = (row as { assets?: unknown }).assets
    const asset = Array.isArray(assetRaw) ? assetRaw[0] : assetRaw
    const ticker = (asset as { ticker?: string } | null)?.ticker
    const priceSource = (asset as { price_source?: string } | null)?.price_source as
      | 'finnhub'
      | 'coingecko'
      | 'alpaca'
      | 'bitkub'
      | undefined

    if (!ticker || !priceSource) continue

    try {
      const livePrice = await fetchPrice(supabase, row.asset_id, ticker, priceSource)
      priceMap.set(row.asset_id, { price: livePrice.price, currency: livePrice.currency ?? 'USD' })
      currencies.add(livePrice.currency ?? 'USD')
    } catch {
      // fall back to cached price or zero
    }
  }

  const fxRateData = await ensureFxRates(supabase, Array.from(currencies))
  const rateToUsdMap: Record<string, string | number> = { USD: 1 }
  for (const [currency, row] of Object.entries(fxRateData)) {
    rateToUsdMap[currency] = row.rate_to_usd
  }

  const holdingsValue = rows.reduce((sum, h) => {
    const quote = priceMap.get(h.asset_id)
    const price = new Decimal(quote?.price ?? '0')
    const nativeValue = new Decimal(h.quantity as string).mul(price)
    return sum.plus(convertAmount(nativeValue, quote?.currency ?? 'USD', silo.base_currency, rateToUsdMap))
  }, new Decimal(0))

  const convertedCash = convertAmount(
    silo.cash_balance ?? '0',
    cashCurrencyForPlatform(silo.platform_type, silo.base_currency),
    silo.base_currency,
    rateToUsdMap,
  )

  return holdingsValue.plus(convertedCash).toFixed(8)
}

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })
  }

  const [silosResult, profileResult] = await Promise.all([
    supabase
      .from('silos')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    supabase
      .from('user_profiles')
      .select('alpaca_mode')
      .eq('id', user.id)
      .single(),
  ])

  if (silosResult.error) {
    return NextResponse.json({ error: { code: 'FETCH_FAILED', message: silosResult.error.message } }, { status: 500 })
  }

  const silos = silosResult.data ?? []
  const alpacaMode = profileResult.data?.alpaca_mode ?? 'paper'
  const activeSiloCount = silos.length

  const totalValues = await Promise.all(
    silos.map(silo => computeSiloTotalValue(supabase, {
      id: silo.id,
      cash_balance: silo.cash_balance ?? '0',
      base_currency: silo.base_currency,
      platform_type: silo.platform_type,
    }))
  )

  const response = silos.map((silo, i) => {
    const r = buildSiloResponse(silo, activeSiloCount, 5, alpacaMode)
    r.total_value = totalValues[i]
    return r
  })

  return NextResponse.json(response)
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })
  }

  // CLAUDE.md Rule 8: check 5-silo limit before INSERT
  const limitReached = await checkSiloLimit(supabase, user.id)
  if (limitReached) {
    return NextResponse.json(
      { error: { code: 'SILO_LIMIT_REACHED', message: 'Maximum of 5 active silos reached' } },
      { status: 422 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: { code: 'INVALID_JSON', message: 'Invalid request body' } }, { status: 400 })
  }

  const { name, platform_type, base_currency, drift_threshold, cash_balance } = body as {
    name?: unknown
    platform_type?: unknown
    base_currency?: unknown
    drift_threshold?: unknown
    cash_balance?: unknown
  }

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json({ error: { code: 'INVALID_VALUE', message: 'name is required' } }, { status: 400 })
  }

  if (!platform_type || !VALID_PLATFORM_TYPES.includes(platform_type as typeof VALID_PLATFORM_TYPES[number])) {
    return NextResponse.json(
      { error: { code: 'INVALID_VALUE', message: 'platform_type must be one of: alpaca | bitkub | innovestx | schwab | webull | manual' } },
      { status: 400 },
    )
  }

  const currency = typeof base_currency === 'string' && base_currency.length === 3
    ? base_currency.toUpperCase()
    : 'USD'

  const threshold = typeof drift_threshold === 'number' ? drift_threshold : 5.0
  const cashBalance = typeof cash_balance === 'string' ? cash_balance : '0.00000000'

  const { data: newSilo, error: insertError } = await supabase
    .from('silos')
    .insert({
      user_id: user.id,
      name: name.trim(),
      platform_type,
      base_currency: currency,
      drift_threshold: threshold,
      cash_balance: cashBalance,
    })
    .select('*')
    .single()

  if (insertError || !newSilo) {
    return NextResponse.json({ error: { code: 'INSERT_FAILED', message: insertError?.message ?? 'Insert failed' } }, { status: 500 })
  }

  // Re-count after insert for the response
  const { count: newCount } = await supabase
    .from('silos')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_active', true)

  return NextResponse.json(buildSiloResponse(newSilo, newCount ?? 1, 5), { status: 201 })
}
