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
import {
  buildSettradeBasicAuth,
  parseSettradePortfolio,
  buildInnovestxDigitalSignature,
  parseInnovestxDigitalBalances,
  SETTRADE_BASE_URL,
  SETTRADE_TOKEN_PATH,
  SETTRADE_ACCOUNTS_PATH,
  SETTRADE_PORTFOLIO_PATH,
  INNOVESTX_DIGITAL_BASE_URL,
  INNOVESTX_DIGITAL_HOST,
  INNOVESTX_DIGITAL_BALANCES_PATH,
  INNOVESTX_DIGITAL_CONTENT_TYPE,
} from '@/lib/innovestx'
import { parseSchwabPositions, SCHWAB_ACCOUNTS_URL } from '@/lib/schwab'
import { buildWebullSignature, parseWebullPositions, WEBULL_BASE_URL, WEBULL_POSITIONS_PATH } from '@/lib/webull'
import { fetchPrice } from '@/lib/priceService'

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

  if (silo.platform_type === 'innovestx') {
    return syncInnovestx(supabase, user.id, silo_id)
  }

  if (silo.platform_type === 'schwab') {
    return syncSchwab(supabase, user.id, silo_id)
  }

  if (silo.platform_type === 'webull') {
    return syncWebull(supabase, user.id, silo_id)
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

// ---------------------------------------------------------------------------
// INNOVESTX sync — STORY-014 (equity) + STORY-014b (digital asset)
// Equity branch:  Settrade OAuth → portfolio → Finnhub prices
// Digital branch: HMAC-SHA256 → InnovestX Digital API → CoinGecko prices
// AC5/AC3: each branch runs independently — missing creds → sync_warnings
// AC7:     all HTTP calls are server-side only (CLAUDE.md Rule 5)
// ---------------------------------------------------------------------------

interface SettradeTokenResponse {
  access_token: string
  token_type: string
}

interface SettradeAccount {
  account_no: string
  [key: string]: unknown
}

async function syncInnovestx(
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

  // 1. Fetch both sets of encrypted credentials in one query
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('innovestx_key_enc, innovestx_secret_enc, innovestx_digital_key_enc, innovestx_digital_secret_enc')
    .eq('id', userId)
    .single()

  const syncedAt = new Date().toISOString()
  const syncWarnings: string[] = []
  let totalHoldingsUpdated = 0

  // -------------------------------------------------------------------------
  // Equity branch (Settrade OAuth)
  // -------------------------------------------------------------------------
  if (profile?.innovestx_key_enc && profile?.innovestx_secret_enc) {
    let settradeAppId: string
    let settradeAppSecret: string
    try {
      settradeAppId = decrypt(profile.innovestx_key_enc, encKey)
      settradeAppSecret = decrypt(profile.innovestx_secret_enc, encKey)
    } catch {
      return NextResponse.json(
        { error: { code: 'DECRYPTION_FAILED', message: 'Failed to decrypt Settrade credentials' } },
        { status: 500 },
      )
    }

    const basicAuth = buildSettradeBasicAuth(settradeAppId, settradeAppSecret)

    let accessToken: string
    try {
      const tokenRes = await fetch(`${SETTRADE_BASE_URL}${SETTRADE_TOKEN_PATH}`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
        cache: 'no-store',
      })
      if (!tokenRes.ok) throw new Error(`Settrade auth returned ${tokenRes.status}`)
      const tokenData = (await tokenRes.json()) as SettradeTokenResponse
      accessToken = tokenData.access_token
    } catch {
      return NextResponse.json(
        { error: { code: 'BROKER_UNAVAILABLE', message: 'Settrade authentication failed' } },
        { status: 503 },
      )
    }

    let accountNo: string
    try {
      const accountsRes = await fetch(`${SETTRADE_BASE_URL}${SETTRADE_ACCOUNTS_PATH}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        cache: 'no-store',
      })
      if (!accountsRes.ok) throw new Error(`Settrade accounts returned ${accountsRes.status}`)
      const accountsData = (await accountsRes.json()) as SettradeAccount[]
      if (!accountsData.length) {
        return NextResponse.json(
          { error: { code: 'BROKER_UNAVAILABLE', message: 'No Settrade accounts found' } },
          { status: 503 },
        )
      }
      accountNo = accountsData[0].account_no
    } catch {
      return NextResponse.json(
        { error: { code: 'BROKER_UNAVAILABLE', message: 'Settrade accounts endpoint unreachable' } },
        { status: 503 },
      )
    }

    let rawPortfolio: unknown
    try {
      const portfolioRes = await fetch(
        `${SETTRADE_BASE_URL}${SETTRADE_PORTFOLIO_PATH(accountNo)}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` }, cache: 'no-store' },
      )
      if (!portfolioRes.ok) throw new Error(`Settrade portfolio returned ${portfolioRes.status}`)
      rawPortfolio = await portfolioRes.json()
    } catch {
      return NextResponse.json(
        { error: { code: 'BROKER_UNAVAILABLE', message: 'Settrade portfolio endpoint unreachable' } },
        { status: 503 },
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const positions = parseSettradePortfolio(rawPortfolio as any)

    for (const pos of positions) {
      const { data: existingAsset } = await supabase
        .from('assets')
        .select('id')
        .eq('ticker', pos.ticker)
        .eq('price_source', 'finnhub')
        .maybeSingle()

      let assetId: string
      if (existingAsset) {
        assetId = existingAsset.id
      } else {
        const { data: newAsset, error: assetErr } = await supabase
          .from('assets')
          .insert({ ticker: pos.ticker, name: pos.ticker, asset_type: 'stock', price_source: 'finnhub' })
          .select('id')
          .single()
        if (assetErr || !newAsset) continue
        assetId = newAsset.id
      }

      await supabase
        .from('asset_mappings')
        .upsert(
          { silo_id: siloId, asset_id: assetId, local_label: pos.ticker },
          { onConflict: 'silo_id,asset_id', ignoreDuplicates: true },
        )

      const { error: holdingErr } = await supabase
        .from('holdings')
        .upsert(
          { silo_id: siloId, asset_id: assetId, quantity: pos.quantity, cash_balance: '0', source: 'innovestx_sync', last_updated_at: syncedAt },
          { onConflict: 'silo_id,asset_id' },
        )
      if (!holdingErr) totalHoldingsUpdated++

      try {
        await fetchPrice(supabase, assetId, pos.ticker, 'finnhub')
      } catch {
        // non-fatal — stale cache remains
      }
    }
  } else {
    // AC5: equity creds missing → skip with warning (no crash)
    syncWarnings.push('Settrade equity credentials not configured — equity sync skipped')
  }

  // -------------------------------------------------------------------------
  // Digital asset branch (HMAC-SHA256) — AC3
  // -------------------------------------------------------------------------
  if (profile?.innovestx_digital_key_enc && profile?.innovestx_digital_secret_enc) {
    let digitalKey: string
    let digitalSecret: string
    try {
      digitalKey = decrypt(profile.innovestx_digital_key_enc, encKey)
      digitalSecret = decrypt(profile.innovestx_digital_secret_enc, encKey)
    } catch {
      return NextResponse.json(
        { error: { code: 'DECRYPTION_FAILED', message: 'Failed to decrypt InnovestX Digital credentials' } },
        { status: 500 },
      )
    }

    const timestamp = Date.now().toString()
    const requestUid = crypto.randomUUID()
    const signature = buildInnovestxDigitalSignature(
      digitalKey,
      digitalSecret,
      'GET',
      INNOVESTX_DIGITAL_HOST,
      INNOVESTX_DIGITAL_BALANCES_PATH,
      '',
      INNOVESTX_DIGITAL_CONTENT_TYPE,
      requestUid,
      timestamp,
      '',
    )

    let rawBalances: unknown
    try {
      const balancesRes = await fetch(
        `${INNOVESTX_DIGITAL_BASE_URL}${INNOVESTX_DIGITAL_BALANCES_PATH}`,
        {
          headers: {
            'X-INVX-APIKEY': digitalKey,
            'X-INVX-SIGNATURE': signature,
            'X-INVX-TIMESTAMP': timestamp,
            'X-INVX-REQUEST-UID': requestUid,
          },
          cache: 'no-store',
        },
      )
      if (!balancesRes.ok) throw new Error(`InnovestX Digital balances returned ${balancesRes.status}`)
      rawBalances = await balancesRes.json()
    } catch {
      return NextResponse.json(
        { error: { code: 'BROKER_UNAVAILABLE', message: 'InnovestX Digital API is unreachable or returned an error' } },
        { status: 503 },
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const digitalHoldings = parseInnovestxDigitalBalances(rawBalances as any)

    for (const h of digitalHoldings) {
      const { data: existingAsset } = await supabase
        .from('assets')
        .select('id')
        .eq('ticker', h.symbol)
        .eq('price_source', 'coingecko')
        .maybeSingle()

      let assetId: string
      if (existingAsset) {
        assetId = existingAsset.id
      } else {
        const { data: newAsset, error: assetErr } = await supabase
          .from('assets')
          .insert({ ticker: h.symbol, name: h.symbol, asset_type: 'crypto', price_source: 'coingecko' })
          .select('id')
          .single()
        if (assetErr || !newAsset) continue
        assetId = newAsset.id
      }

      await supabase
        .from('asset_mappings')
        .upsert(
          { silo_id: siloId, asset_id: assetId, local_label: h.symbol },
          { onConflict: 'silo_id,asset_id', ignoreDuplicates: true },
        )

      const { error: holdingErr } = await supabase
        .from('holdings')
        .upsert(
          { silo_id: siloId, asset_id: assetId, quantity: h.quantity, cash_balance: '0', source: 'innovestx_sync', last_updated_at: syncedAt },
          { onConflict: 'silo_id,asset_id' },
        )
      if (!holdingErr) totalHoldingsUpdated++

      // AC4: Fetch CoinGecko price — use stale cache on failure
      try {
        await fetchPrice(supabase, assetId, h.symbol, 'coingecko')
      } catch {
        // non-fatal — stale cache remains
      }
    }
  } else {
    // AC5: digital creds missing → skip with warning (no crash)
    syncWarnings.push('InnovestX Digital Asset credentials not configured — digital sync skipped')
  }

  // -------------------------------------------------------------------------
  // Update silo.last_synced_at
  // -------------------------------------------------------------------------
  await supabase
    .from('silos')
    .update({ last_synced_at: syncedAt })
    .eq('id', siloId)
    .eq('user_id', userId)

  const response: Record<string, unknown> = {
    synced_at: syncedAt,
    holdings_updated: totalHoldingsUpdated,
    platform: 'innovestx',
  }
  if (syncWarnings.length > 0) response.sync_warnings = syncWarnings

  return NextResponse.json(response)
}

// ---------------------------------------------------------------------------
// SCHWAB sync — STORY-015b
// AC1: if schwab_token_expires is in the past, return 401 SCHWAB_TOKEN_EXPIRED
// AC2: fetch positions from trader/v1/accounts?fields=positions, upsert holdings
// AC3: update last_synced_at after successful sync
// AC7: all Schwab HTTP calls are server-side only (CLAUDE.md Rule 5)
// ---------------------------------------------------------------------------

async function syncSchwab(
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

  // 1. Fetch Schwab OAuth tokens from user_profiles
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('schwab_access_enc, schwab_refresh_enc, schwab_token_expires')
    .eq('id', userId)
    .single()

  if (!profile?.schwab_access_enc || !profile?.schwab_refresh_enc) {
    return NextResponse.json(
      { error: { code: 'SCHWAB_NOT_CONNECTED', message: 'Schwab account not connected — complete OAuth flow in Settings' } },
      { status: 403 },
    )
  }

  // AC1: check refresh token expiry — if expired, user must re-authenticate
  if (profile.schwab_token_expires !== null && new Date(profile.schwab_token_expires) < new Date()) {
    return NextResponse.json(
      { error: { code: 'SCHWAB_TOKEN_EXPIRED', message: 'Schwab token has expired — reconnect in Settings' } },
      { status: 401 },
    )
  }

  // 2. Decrypt access token — used for the positions API call
  let accessToken: string
  try {
    accessToken = decrypt(profile.schwab_access_enc, encKey)
  } catch {
    return NextResponse.json(
      { error: { code: 'DECRYPTION_FAILED', message: 'Failed to decrypt Schwab credentials' } },
      { status: 500 },
    )
  }

  // 3. Fetch positions from Schwab trader API (AC2 + AC7: server-side only)
  let rawAccounts: unknown
  try {
    const accountsRes = await fetch(`${SCHWAB_ACCOUNTS_URL}?fields=positions`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    // AC1: access token expired mid-window → instruct user to reconnect
    if (accountsRes.status === 401) {
      return NextResponse.json(
        { error: { code: 'SCHWAB_TOKEN_EXPIRED', message: 'Schwab access token expired — reconnect in Settings' } },
        { status: 401 },
      )
    }
    if (!accountsRes.ok) {
      throw new Error(`Schwab accounts returned ${accountsRes.status}`)
    }
    rawAccounts = await accountsRes.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'BROKER_UNAVAILABLE', message: 'Schwab API is unreachable or returned an error' } },
      { status: 503 },
    )
  }

  // 4. Parse positions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const positions = parseSchwabPositions(rawAccounts as any)

  const syncedAt = new Date().toISOString()
  let holdingsUpdated = 0

  // 5. Upsert each position: find/create asset → ensure asset_mapping → upsert holding
  for (const pos of positions) {
    const { data: existingAsset } = await supabase
      .from('assets')
      .select('id')
      .eq('ticker', pos.symbol)
      .eq('price_source', 'finnhub')
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
          asset_type: 'stock',
          price_source: 'finnhub',
        })
        .select('id')
        .single()

      if (assetErr || !newAsset) continue
      assetId = newAsset.id
    }

    // Ensure asset_mapping exists for this silo (best-effort, ignore conflict)
    await supabase
      .from('asset_mappings')
      .upsert(
        { silo_id: siloId, asset_id: assetId, local_label: pos.symbol },
        { onConflict: 'silo_id,asset_id', ignoreDuplicates: true },
      )

    // Upsert holding — AC2: source = 'schwab_sync'
    const { error: holdingErr } = await supabase
      .from('holdings')
      .upsert(
        {
          silo_id: siloId,
          asset_id: assetId,
          quantity: pos.quantity,
          cost_basis: pos.costBasis ?? null,
          cash_balance: '0',
          source: 'schwab_sync',
          last_updated_at: syncedAt,
        },
        { onConflict: 'silo_id,asset_id' },
      )

    if (!holdingErr) holdingsUpdated++

    try {
      await fetchPrice(supabase, assetId, pos.symbol, 'finnhub')
    } catch {
      // non-fatal — stale cache remains
    }
  }

  // 6. AC3: update silo.last_synced_at
  await supabase
    .from('silos')
    .update({ last_synced_at: syncedAt })
    .eq('id', siloId)
    .eq('user_id', userId)

  return NextResponse.json({
    synced_at: syncedAt,
    holdings_updated: holdingsUpdated,
    platform: 'schwab',
  })
}

// ---------------------------------------------------------------------------
// WEBULL sync — STORY-016
// AC1: decrypt webull_key_enc / webull_secret_enc
// AC2: fetch positions from Webull API, upsert holdings, update last_synced_at
// AC7: all Webull HTTP calls are server-side only (CLAUDE.md Rule 5)
// Note: Webull API endpoint patterns are best-effort; verify against official
//       Webull broker developer API docs once credentials are obtained.
// ---------------------------------------------------------------------------

async function syncWebull(
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
    .select('webull_key_enc, webull_secret_enc')
    .eq('id', userId)
    .single()

  if (!profile?.webull_key_enc || !profile?.webull_secret_enc) {
    return NextResponse.json(
      { error: { code: 'WEBULL_NOT_CONNECTED', message: 'Webull API key not configured' } },
      { status: 403 },
    )
  }

  let webullKey: string
  let webullSecret: string
  try {
    webullKey = decrypt(profile.webull_key_enc, encKey)
    webullSecret = decrypt(profile.webull_secret_enc, encKey)
  } catch {
    return NextResponse.json(
      { error: { code: 'DECRYPTION_FAILED', message: 'Failed to decrypt Webull credentials' } },
      { status: 500 },
    )
  }

  // 2. Fetch positions from Webull API (AC2, AC7: server-side only)
  const timestamp = Date.now().toString()
  const signature = buildWebullSignature(webullSecret, 'GET', WEBULL_POSITIONS_PATH, timestamp)

  let rawPositions: unknown
  try {
    const positionsRes = await fetch(`${WEBULL_BASE_URL}${WEBULL_POSITIONS_PATH}`, {
      headers: {
        'X-WBL-APIKEY': webullKey,
        'X-WBL-SIGNATURE': signature,
        'X-WBL-TIMESTAMP': timestamp,
      },
      cache: 'no-store',
    })
    if (!positionsRes.ok) throw new Error(`Webull returned ${positionsRes.status}`)
    rawPositions = await positionsRes.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'BROKER_UNAVAILABLE', message: 'Webull API is unreachable or returned an error' } },
      { status: 503 },
    )
  }

  // 3. Parse and upsert positions
  const positions = parseWebullPositions(rawPositions)
  const syncedAt = new Date().toISOString()
  let holdingsUpdated = 0

  for (const pos of positions) {
    const { data: existingAsset } = await supabase
      .from('assets')
      .select('id')
      .eq('ticker', pos.ticker)
      .eq('price_source', 'finnhub')
      .maybeSingle()

    let assetId: string
    if (existingAsset) {
      assetId = existingAsset.id
    } else {
      const { data: newAsset, error: assetErr } = await supabase
        .from('assets')
        .insert({
          ticker: pos.ticker,
          name: pos.ticker,
          asset_type: pos.assetType,
          price_source: 'finnhub',
        })
        .select('id')
        .single()

      if (assetErr || !newAsset) continue
      assetId = newAsset.id
    }

    await supabase
      .from('asset_mappings')
      .upsert(
        { silo_id: siloId, asset_id: assetId, local_label: pos.ticker },
        { onConflict: 'silo_id,asset_id', ignoreDuplicates: true },
      )

    const { error: holdingErr } = await supabase
      .from('holdings')
      .upsert(
        {
          silo_id: siloId,
          asset_id: assetId,
          quantity: pos.quantity,
          cost_basis: pos.costBasis ?? null,
          cash_balance: '0',
          source: 'webull_sync',
          last_updated_at: syncedAt,
        },
        { onConflict: 'silo_id,asset_id' },
      )

    if (!holdingErr) holdingsUpdated++
  }

  // 4. AC2: update silo.last_synced_at
  await supabase
    .from('silos')
    .update({ last_synced_at: syncedAt })
    .eq('id', siloId)
    .eq('user_id', userId)

  return NextResponse.json({
    synced_at: syncedAt,
    holdings_updated: holdingsUpdated,
    platform: 'webull',
  })
}
