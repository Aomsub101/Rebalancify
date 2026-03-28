/**
 * lib/silos.ts
 * Silo helpers — limit check and response builder.
 * checkSiloLimit is used by POST /api/silos before INSERT.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type PlatformType = 'alpaca' | 'bitkub' | 'innovestx' | 'schwab' | 'webull' | 'manual'

/** Default base_currency per platform type (pre-fills the create-silo form). */
export const PLATFORM_DEFAULT_CURRENCY: Record<PlatformType, string> = {
  alpaca: 'USD',
  bitkub: 'THB',
  innovestx: 'THB',
  schwab: 'USD',
  webull: 'USD',
  manual: 'USD',
}

export interface SiloRow {
  id: string
  user_id: string
  name: string
  platform_type: string
  base_currency: string
  drift_threshold: number
  is_active: boolean
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

export interface SiloResponse {
  id: string
  name: string
  platform_type: string
  base_currency: string
  drift_threshold: number
  is_active: boolean
  last_synced_at: string | null
  total_value: string
  weights_sum_pct: number
  cash_target_pct: number
  active_silo_count: number
  silo_limit: number
  alpaca_mode?: string
}

/**
 * Returns true if the user has already reached the 5-silo limit.
 * Must be called before any INSERT into silos.
 * Per CLAUDE.md Rule 8: if count >= 5, return HTTP 422 SILO_LIMIT_REACHED.
 */
export async function checkSiloLimit(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { count } = await supabase
    .from('silos')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_active', true)

  return (count ?? 0) >= 5
}

/**
 * Maps a silos DB row to the API response shape.
 * total_value is "0.00000000" until holdings are added (STORY-005 scope).
 * weights_sum_pct and cash_target_pct default to 0 / 100 until target weights are set.
 * alpaca_mode is only included for Alpaca-type silos; sourced from user_profiles.
 */
export function buildSiloResponse(
  row: SiloRow,
  activeSiloCount: number,
  siloLimit: number,
  alpacaMode?: string,
): SiloResponse {
  const response: SiloResponse = {
    id: row.id,
    name: row.name,
    platform_type: row.platform_type,
    base_currency: row.base_currency,
    drift_threshold: row.drift_threshold,
    is_active: row.is_active,
    last_synced_at: row.last_synced_at,
    total_value: '0.00000000',
    weights_sum_pct: 0,
    cash_target_pct: 100,
    active_silo_count: activeSiloCount,
    silo_limit: siloLimit,
  }
  if (row.platform_type === 'alpaca' && alpacaMode !== undefined) {
    response.alpaca_mode = alpacaMode
  }
  return response
}
