/**
 * GET /api/assets/:asset_id/peers
 *
 * Returns 5–8 peer assets for the given asset using Finnhub /stock/peers.
 * Falls back to sector_taxonomy.json when Finnhub is unavailable.
 *
 * AC-1: 5–8 peers from Finnhub /stock/peers
 * AC-2: Finnhub unavailable → sector_taxonomy.json fallback (no error exposed)
 * AC-3: Each peer includes ticker, name, current_price (from price_cache)
 * AC-4: No AiInsightTag field in v1.0 response
 * AC-5: Any authenticated user can call this endpoint (assets/price_cache have USING(TRUE) RLS)
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import taxonomy from '@/sector_taxonomy.json'

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY ?? ''
const MAX_PEERS = 8
const MIN_PEERS = 5
const FINNHUB_TIMEOUT_MS = 5_000

type Taxonomy = Record<string, string[]>

type RouteContext = { params: Promise<{ asset_id: string }> }

interface AssetRow {
  id: string
  ticker: string
  name: string
  sector: string | null
}

interface PeerAssetRow {
  id: string
  ticker: string
  name: string
}

interface PriceCacheRow {
  asset_id: string
  price: string
}

interface ResearchSessionRow {
  ticker: string
  output: unknown
  created_at: string
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(
  _request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 },
    )
  }

  const { asset_id } = await params

  // Determine if user has LLM connected (do NOT expose key)
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('llm_key_enc')
    .eq('id', user.id)
    .single()

  const llmConnected = profile?.llm_key_enc != null

  // -------------------------------------------------------------------------
  // Step 1: Resolve the queried asset
  // -------------------------------------------------------------------------
  const { data: asset, error: assetError } = await supabase
    .from('assets')
    .select('id, ticker, name, sector')
    .eq('id', asset_id)
    .single()

  if (assetError || !asset) {
    return NextResponse.json(
      { error: { code: 'ASSET_NOT_FOUND', message: 'Asset not found' } },
      { status: 404 },
    )
  }

  const assetRow = asset as AssetRow

  // -------------------------------------------------------------------------
  // Step 2: Try Finnhub /stock/peers
  // -------------------------------------------------------------------------
  let peerTickers: string[] = []
  let finnhubSucceeded = false

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/peers?symbol=${encodeURIComponent(assetRow.ticker)}&token=${FINNHUB_API_KEY}`,
      { signal: AbortSignal.timeout(FINNHUB_TIMEOUT_MS) },
    )
    if (res.ok) {
      const data: string[] = await res.json()
      const filtered = data.filter((t) => t !== assetRow.ticker)
      if (filtered.length >= MIN_PEERS) {
        peerTickers = filtered.slice(0, MAX_PEERS)
        finnhubSucceeded = true
      }
    }
  } catch {
    // Fallthrough to static fallback — AC-2: no error shown to user
  }

  // -------------------------------------------------------------------------
  // Step 3: Static fallback via sector_taxonomy.json
  // -------------------------------------------------------------------------
  if (!finnhubSucceeded) {
    const sector = assetRow.sector ?? ''
    const sectorPeers: string[] = (taxonomy as unknown as Taxonomy)[sector] ?? []
    peerTickers = sectorPeers
      .filter((t) => t !== assetRow.ticker)
      .slice(0, MAX_PEERS)
  }

  if (peerTickers.length === 0) {
    return NextResponse.json([])
  }

  // -------------------------------------------------------------------------
  // Step 4: Look up peer assets in the assets table
  // -------------------------------------------------------------------------
  const { data: peerAssetsRaw } = await supabase
    .from('assets')
    .select('id, ticker, name')
    .in('ticker', peerTickers)

  const peerAssets = (peerAssetsRaw ?? []) as PeerAssetRow[]

  if (peerAssets.length === 0) {
    // Return minimal records if tickers not yet registered in assets table
    return NextResponse.json(
      peerTickers.map((ticker) => ({
        ticker,
        name: ticker,
        current_price: '0.00000000',
      })),
    )
  }

  // -------------------------------------------------------------------------
  // Step 5: Fetch prices from price_cache
  // -------------------------------------------------------------------------
  const peerAssetIds = peerAssets.map((a) => a.id)

  const { data: priceRowsRaw } = await supabase
    .from('price_cache')
    .select('asset_id, price')
    .in('asset_id', peerAssetIds)

  const priceMap = new Map<string, string>()
  for (const row of (priceRowsRaw ?? []) as PriceCacheRow[]) {
    priceMap.set(row.asset_id, String(row.price))
  }

  // -------------------------------------------------------------------------
  // Step 6: Merge and return — preserve order from peerTickers
  // -------------------------------------------------------------------------
  const assetByTicker = new Map(peerAssets.map((a) => [a.ticker, a]))

  const result = peerTickers
    .map((ticker) => {
      const a = assetByTicker.get(ticker)
      if (!a) return null
      const rawPrice = priceMap.get(a.id)
      const current_price = rawPrice != null
        ? parseFloat(rawPrice).toFixed(8)
        : '0.00000000'
      return { ticker: a.ticker, name: a.name, current_price }
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)

  // -------------------------------------------------------------------------
  // Step 7 (v2.0): Optional AI insight tag from cached research_sessions
  // - No LLM calls; use user's cached sessions only.
  // - Only include field when llm_connected is true.
  // -------------------------------------------------------------------------
  if (!llmConnected || result.length === 0) {
    return NextResponse.json(result)
  }

  const tickers = result.map((r) => r.ticker)
  const { data: sessionsRaw } = await supabase
    .from('research_sessions')
    .select('ticker, output, created_at')
    .eq('user_id', user.id)
    .in('ticker', tickers)
    .order('created_at', { ascending: false })

  const sessions = (sessionsRaw ?? []) as ResearchSessionRow[]

  const tagByTicker = new Map<string, string>()
  for (const s of sessions) {
    if (tagByTicker.has(s.ticker)) continue
    const output = s.output as any
    const raw =
      output?.relationship_insight ??
      (typeof output?.summary === 'string'
        ? String(output.summary).trim().split(/\s+/).slice(0, 12).join(' ')
        : '')
    const tag = String(raw ?? '').trim()
    if (tag) tagByTicker.set(s.ticker, tag)
  }

  const enriched = result.map((r) => {
    const tag = tagByTicker.get(r.ticker)
    return tag ? { ...r, ai_insight_tag: tag } : r
  })

  return NextResponse.json(enriched)
}
