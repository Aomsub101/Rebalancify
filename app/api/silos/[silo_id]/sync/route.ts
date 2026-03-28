/**
 * POST /api/silos/:silo_id/sync
 *
 * Fetches live positions + cash from Alpaca API, upserts into holdings table.
 * All Alpaca HTTP calls are server-side — zero browser exposure (CLAUDE.md Rule 5, AC6).
 *
 * AC5:  Fetches positions from Alpaca, upserts holdings, updates last_synced_at.
 * AC8:  Returns 503 BROKER_UNAVAILABLE when Alpaca is unreachable.
 * AC9:  Returns 422 MANUAL_SILO_NO_SYNC for manual silos.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/encryption'
import { buildBitkubSignature, parseBitkubTicker, parseBitkubWallet } from '@/lib/bitkub'

type Params = Promise<{ silo_id: string }>

const ALPACA_PAPER_URL = 'https://paper-api.alpaca.markets'
const ALPACA_LIVE_URL = 'https://api.alpaca.markets'

interface AlpacaPosition {
  symbol: string
  qty: string
  asset_class: string
  cost_basis: string | null
}

interface AlpacaAccount {
  cash: string
}

function unauthorized() {
  return NextResponse.json(
    { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
    { status: 401 },
  )
}

async function fetchAlpaca<T>(
  path: string,
  baseUrl: string,
  keyId: string,
  secretKey: string,
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: {
      'APCA-API-KEY-ID': keyId,
      'APCA-API-SECRET-KEY': secretKey,
    },
    // Next.js should not cache these broker calls
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`Alpaca ${path} returned ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function POST(_req: NextRequest, { params }: { params: Params }) {
  const supabase = await createClient()
  const { silo_id } = await params

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return unauthorized()

  // 1. Verify silo ownership
  const { data: silo } = await supabase
    .from('silos')
    .select('id, platform_type')
    .eq('id', silo_id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!silo) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Silo not found' } },
      { status: 404 },
    )
  }

  // AC9: manual silos cannot sync
  if (silo.platform_type === 'manual') {
    return NextResponse.json(
      { error: { code: 'MANUAL_SILO_NO_SYNC', message: 'Manual silos do not support sync' } },
      { status: 422 },
    )
  }

  // Route to the correct broker sync handler
  if (silo.platform_type === 'bitkub') {
    return syncBitkub(supabase, user.id, silo_id)
  }

  if (silo.platform_type !== 'alpaca') {
    return NextResponse.json(
      { error: { code: 'SYNC_NOT_IMPLEMENTED', message: `Sync not yet supported for ${silo.platform_type}` } },
      { status: 422 },
    )
  }

  // 2. Fetch Alpaca credentials from user_profiles
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('alpaca_key_enc, alpaca_secret_enc, alpaca_mode')
    .eq('id', user.id)
    .single()

  if (!profile?.alpaca_key_enc || !profile?.alpaca_secret_enc) {
    return NextResponse.json(
      { error: { code: 'ALPACA_NOT_CONNECTED', message: 'Alpaca API key not configured' } },
      { status: 403 },
    )
  }

  const encKey = process.env.ENCRYPTION_KEY
  if (!encKey) {
    return NextResponse.json(
      { error: { code: 'ENCRYPTION_KEY_MISSING', message: 'Server encryption key not configured' } },
      { status: 500 },
    )
  }

  let alpacaKey: string
  let alpacaSecret: string
  try {
    alpacaKey = decrypt(profile.alpaca_key_enc, encKey)
    alpacaSecret = decrypt(profile.alpaca_secret_enc, encKey)
  } catch {
    return NextResponse.json(
      { error: { code: 'DECRYPTION_FAILED', message: 'Failed to decrypt Alpaca credentials' } },
      { status: 500 },
    )
  }

  const baseUrl = profile.alpaca_mode === 'live' ? ALPACA_LIVE_URL : ALPACA_PAPER_URL

  // 3. Fetch positions + account cash from Alpaca (AC8: catch network errors → 503)
  let positions: AlpacaPosition[]
  let account: AlpacaAccount
  try {
    ;[positions, account] = await Promise.all([
      fetchAlpaca<AlpacaPosition[]>('/v2/positions', baseUrl, alpacaKey, alpacaSecret),
      fetchAlpaca<AlpacaAccount>('/v2/account', baseUrl, alpacaKey, alpacaSecret),
    ])
  } catch {
    return NextResponse.json(
      { error: { code: 'BROKER_UNAVAILABLE', message: 'Alpaca API is unreachable or returned an error' } },
      { status: 503 },
    )
  }

  // 4. Upsert each position: find or create asset → find or create asset_mapping → upsert holding
  let holdingsUpdated = 0
  const syncedAt = new Date().toISOString()

  for (const pos of positions) {
    const assetType = pos.asset_class === 'crypto' ? 'crypto' : 'stock'

    // Find or create the asset record (unique on ticker + price_source)
    const { data: existingAsset } = await supabase
      .from('assets')
      .select('id')
      .eq('ticker', pos.symbol)
      .eq('price_source', 'alpaca')
      .maybeSingle()

    let assetId: string
    if (existingAsset) {
      assetId = existingAsset.id
    } else {
      const { data: newAsset, error: assetErr } = await supabase
        .from('assets')
        .insert({
          ticker: pos.symbol,
          name: pos.symbol,
          asset_type: assetType,
          price_source: 'alpaca',
        })
        .select('id')
        .single()

      if (assetErr || !newAsset) continue  // skip if asset creation fails
      assetId = newAsset.id
    }

    // Ensure asset_mapping exists for this silo (best-effort, ignore conflict)
    await supabase
      .from('asset_mappings')
      .upsert(
        { silo_id, asset_id: assetId, local_label: pos.symbol },
        { onConflict: 'silo_id,asset_id', ignoreDuplicates: true },
      )

    // Upsert holding: quantity + source
    const { error: holdingErr } = await supabase
      .from('holdings')
      .upsert(
        {
          silo_id,
          asset_id: assetId,
          quantity: pos.qty,
          cost_basis: pos.cost_basis ?? null,
          cash_balance: '0',
          source: 'alpaca_sync',
          last_updated_at: syncedAt,
        },
        { onConflict: 'silo_id,asset_id' },
      )

    if (!holdingErr) holdingsUpdated++
  }

  // 5. Store account cash: reset all holdings' cash_balance to 0,
  //    then set it on the first holding (or do nothing if no holdings exist).
  //    This preserves the SUM(cash_balance) aggregation used by GET /holdings.
  await supabase
    .from('holdings')
    .update({ cash_balance: '0' })
    .eq('silo_id', silo_id)

  if (positions.length > 0) {
    // Pick any one holding to carry the full cash balance
    const { data: firstAsset } = await supabase
      .from('assets')
      .select('id')
      .eq('ticker', positions[0].symbol)
      .eq('price_source', 'alpaca')
      .maybeSingle()

    if (firstAsset) {
      await supabase
        .from('holdings')
        .update({ cash_balance: account.cash })
        .eq('silo_id', silo_id)
        .eq('asset_id', firstAsset.id)
    }
  }

  // 6. Update silo.last_synced_at
  await supabase
    .from('silos')
    .update({ last_synced_at: syncedAt })
    .eq('id', silo_id)
    .eq('user_id', user.id)

  return NextResponse.json({
    synced_at: syncedAt,
    holdings_updated: holdingsUpdated,
    cash_balance: account.cash,
    platform: 'alpaca',
  })
}

// ---------------------------------------------------------------------------
// BITKUB sync — STORY-013
// AC2: fetch wallet balances, upsert holdings
// AC3: update price_cache from ticker (same API call batch, no extra request)
// AC4: update last_synced_at
// AC5: all BITKUB HTTP calls are server-side only (CLAUDE.md Rule 5)
// AC6: 503 BROKER_UNAVAILABLE on network error
// ---------------------------------------------------------------------------

const BITKUB_BASE_URL = 'https://api.bitkub.com'

interface BitkubTickerRaw {
  [pair: string]: { last: number; [k: string]: unknown }
}

interface BitkubWalletRaw {
  error: number
  result: Record<string, number>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>

async function syncBitkub(
  supabase: SupabaseClient,
  userId: string,
  siloId: string,
): Promise<NextResponse> {
  const encKey = process.env.ENCRYPTION_KEY
  if (!encKey) {
    return NextResponse.json(
      { error: { code: 'ENCRYPTION_KEY_MISSING', message: 'Server encryption key not configured' } },
      { status: 500 },
    )
  }

  // 1. Fetch encrypted credentials
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('bitkub_key_enc, bitkub_secret_enc')
    .eq('id', userId)
    .single()

  if (!profile?.bitkub_key_enc || !profile?.bitkub_secret_enc) {
    return NextResponse.json(
      { error: { code: 'BITKUB_NOT_CONNECTED', message: 'BITKUB API key not configured' } },
      { status: 403 },
    )
  }

  let bitkubKey: string
  let bitkubSecret: string
  try {
    bitkubKey = decrypt(profile.bitkub_key_enc, encKey)
    bitkubSecret = decrypt(profile.bitkub_secret_enc, encKey)
  } catch {
    return NextResponse.json(
      { error: { code: 'DECRYPTION_FAILED', message: 'Failed to decrypt BITKUB credentials' } },
      { status: 500 },
    )
  }

  // 2. Fetch ticker (public) + wallet (authenticated) in parallel — AC3 + AC2
  const ts = Date.now()
  const walletPayload = JSON.stringify({ ts })
  const signature = buildBitkubSignature(walletPayload, bitkubSecret)

  let tickerRaw: BitkubTickerRaw
  let walletRaw: BitkubWalletRaw
  try {
    const [tickerRes, walletRes] = await Promise.all([
      fetch(`${BITKUB_BASE_URL}/api/v2/market/ticker`, { cache: 'no-store' }),
      fetch(`${BITKUB_BASE_URL}/api/v2/market/wallet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-BTK-APIKEY': bitkubKey,
          'X-BTK-SIGN': signature,
        },
        body: walletPayload,
        cache: 'no-store',
      }),
    ])

    if (!tickerRes.ok || !walletRes.ok) {
      throw new Error(`BITKUB returned ${tickerRes.status}/${walletRes.status}`)
    }

    tickerRaw = (await tickerRes.json()) as BitkubTickerRaw
    walletRaw = (await walletRes.json()) as BitkubWalletRaw
  } catch {
    return NextResponse.json(
      { error: { code: 'BROKER_UNAVAILABLE', message: 'BITKUB API is unreachable or returned an error' } },
      { status: 503 },
    )
  }

  if (walletRaw.error !== 0) {
    return NextResponse.json(
      { error: { code: 'BROKER_UNAVAILABLE', message: `BITKUB wallet error code ${walletRaw.error}` } },
      { status: 503 },
    )
  }

  // 3. Parse ticker and wallet
  const tickerEntries = parseBitkubTicker(tickerRaw)
  const [holdings, thbBalance] = parseBitkubWallet(walletRaw)

  // Build a price lookup map: symbol → priceThb
  const priceMap = new Map(tickerEntries.map((t) => [t.symbol, t.priceThb]))

  const syncedAt = new Date().toISOString()
  let holdingsUpdated = 0

  // 4. Upsert each non-zero crypto holding
  for (const h of holdings) {
    // Find or create the asset record (unique on ticker + price_source)
    const { data: existingAsset } = await supabase
      .from('assets')
      .select('id')
      .eq('ticker', h.symbol)
      .eq('price_source', 'bitkub')
      .maybeSingle()

    let assetId: string
    if (existingAsset) {
      assetId = existingAsset.id
    } else {
      const { data: newAsset, error: assetErr } = await supabase
        .from('assets')
        .insert({
          ticker: h.symbol,
          name: h.symbol,
          asset_type: 'crypto',
          price_source: 'bitkub',
        })
        .select('id')
        .single()

      if (assetErr || !newAsset) continue
      assetId = newAsset.id
    }

    // Ensure asset_mapping exists (best-effort, ignore conflict)
    await supabase
      .from('asset_mappings')
      .upsert(
        { silo_id: siloId, asset_id: assetId, local_label: h.symbol },
        { onConflict: 'silo_id,asset_id', ignoreDuplicates: true },
      )

    // Upsert holding
    const { error: holdingErr } = await supabase
      .from('holdings')
      .upsert(
        {
          silo_id: siloId,
          asset_id: assetId,
          quantity: h.quantity,
          cash_balance: '0',
          source: 'bitkub_sync',
          last_updated_at: syncedAt,
        },
        { onConflict: 'silo_id,asset_id' },
      )

    if (!holdingErr) holdingsUpdated++

    // AC3: update price_cache from ticker data (THB price)
    const priceThb = priceMap.get(h.symbol)
    if (priceThb) {
      await supabase
        .from('price_cache')
        .upsert(
          {
            asset_id: assetId,
            price: priceThb,
            currency: 'THB',
            fetched_at: syncedAt,
            source: 'bitkub',
          },
          { onConflict: 'asset_id' },
        )
    }
  }

  // 5. Store THB cash balance: reset all to 0, then set on first holding
  await supabase
    .from('holdings')
    .update({ cash_balance: '0' })
    .eq('silo_id', siloId)

  if (holdings.length > 0) {
    const { data: firstAsset } = await supabase
      .from('assets')
      .select('id')
      .eq('ticker', holdings[0].symbol)
      .eq('price_source', 'bitkub')
      .maybeSingle()

    if (firstAsset) {
      await supabase
        .from('holdings')
        .update({ cash_balance: thbBalance })
        .eq('silo_id', siloId)
        .eq('asset_id', firstAsset.id)
    }
  }

  // 6. AC4: update silo.last_synced_at
  await supabase
    .from('silos')
    .update({ last_synced_at: syncedAt })
    .eq('id', siloId)
    .eq('user_id', userId)

  return NextResponse.json({
    synced_at: syncedAt,
    holdings_updated: holdingsUpdated,
    cash_balance: thbBalance,
    platform: 'bitkub',
  })
}
