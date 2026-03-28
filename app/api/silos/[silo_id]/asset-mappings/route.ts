import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchPrice } from '@/lib/priceService'

type RouteContext = { params: Promise<{ silo_id: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  const supabase = await createClient()
  const { silo_id } = await params

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 }
    )
  }

  const { data, error } = await supabase
    .from('asset_mappings')
    .select('id, local_label, confirmed_at, assets(id, ticker, name, asset_type, price_source, coingecko_id)')
    .eq('silo_id', silo_id)

  if (error) {
    return NextResponse.json(
      { error: { code: 'FETCH_FAILED', message: error.message } },
      { status: 500 }
    )
  }

  return NextResponse.json(data ?? [])
}

export async function POST(request: Request, { params }: RouteContext) {
  const supabase = await createClient()
  const { silo_id } = await params

  // 1. Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 }
    )
  }

  // 2. Parse + validate body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'Invalid request body' } },
      { status: 400 }
    )
  }

  const { ticker, name, asset_type, price_source, local_label, coingecko_id } = body as Record<string, unknown>

  if (
    typeof ticker !== 'string' || !ticker.trim() ||
    typeof name !== 'string' || !name.trim() ||
    typeof asset_type !== 'string' || !asset_type.trim() ||
    typeof price_source !== 'string' || !price_source.trim() ||
    typeof local_label !== 'string' || !local_label.trim()
  ) {
    return NextResponse.json(
      { error: { code: 'MISSING_FIELDS', message: 'ticker, name, asset_type, price_source, local_label are required' } },
      { status: 400 }
    )
  }

  // 3. Verify silo ownership
  const { data: silo, error: siloError } = await supabase
    .from('silos')
    .select('id')
    .eq('id', silo_id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (siloError || !silo) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Silo not found' } },
      { status: 404 }
    )
  }

  // 4. Upsert asset (global registry — unique on ticker + price_source)
  const assetPayload: Record<string, unknown> = {
    ticker: (ticker as string).toUpperCase(),
    name,
    asset_type,
    price_source,
  }
  if (coingecko_id !== undefined) {
    assetPayload.coingecko_id = coingecko_id
  }

  const { data: asset, error: assetError } = await supabase
    .from('assets')
    .upsert(assetPayload, { onConflict: 'ticker,price_source' })
    .select('id, ticker')
    .single()

  if (assetError || !asset) {
    return NextResponse.json(
      { error: { code: 'ASSET_UPSERT_FAILED', message: assetError?.message ?? 'Asset upsert failed' } },
      { status: 500 }
    )
  }

  // 5. Check for existing mapping (CLAUDE.md Rule 19)
  const { data: existingMapping } = await supabase
    .from('asset_mappings')
    .select('id')
    .eq('silo_id', silo_id)
    .eq('asset_id', asset.id)
    .single()

  if (existingMapping) {
    return NextResponse.json(
      { error: { code: 'ASSET_MAPPING_EXISTS', message: 'This asset is already mapped to this silo' } },
      { status: 409 }
    )
  }

  // 6. Insert mapping
  const { data: mapping, error: mappingError } = await supabase
    .from('asset_mappings')
    .insert({ silo_id, asset_id: asset.id, local_label })
    .select('id, asset_id')
    .single()

  if (mappingError || !mapping) {
    return NextResponse.json(
      { error: { code: 'MAPPING_INSERT_FAILED', message: mappingError?.message ?? 'Mapping insert failed' } },
      { status: 500 }
    )
  }

  // 4b. Auto-create holdings row with quantity=0 (best-effort, does not fail if exists)
  try {
    await supabase
      .from('holdings')
      .upsert(
        { silo_id, asset_id: asset.id, quantity: '0.00000000', source: 'manual' },
        { onConflict: 'silo_id,asset_id' }
      )
  } catch {
    // non-fatal — holdings row will be created when user first sets a quantity
  }

  // 7. Best-effort price cache population (AC6) — failure must not block 201
  try {
    await fetchPrice(
      supabase,
      asset.id,
      asset.ticker as string,
      price_source as 'finnhub' | 'coingecko',
      coingecko_id as string | undefined
    )
  } catch {
    // Intentionally silent — price cache failure does not block mapping creation
  }

  // 8. Return 201
  return NextResponse.json(
    { asset_id: asset.id, mapping_id: mapping.id, ticker: asset.ticker },
    { status: 201 }
  )
}
