/**
 * lib/profile.ts
 * Profile response builder — maps DB row to API shape.
 * Derives *_connected booleans from encrypted key columns.
 * Never exposes _enc fields in output.
 */

export interface ProfileRow {
  id: string
  display_name: string | null
  global_currency: string
  show_usd_toggle: boolean
  drift_notif_channel: string
  alpaca_key_enc: string | null
  alpaca_secret_enc: string | null
  alpaca_mode: string
  bitkub_key_enc: string | null
  bitkub_secret_enc: string | null
  innovestx_key_enc: string | null
  innovestx_secret_enc: string | null
  innovestx_digital_key_enc: string | null
  innovestx_digital_secret_enc: string | null
  schwab_access_enc: string | null
  schwab_refresh_enc: string | null
  schwab_token_expires: string | null
  webull_key_enc: string | null
  webull_secret_enc: string | null
  llm_provider: string | null
  llm_key_enc: string | null
  llm_model: string | null
  onboarded: boolean
  progress_banner_dismissed: boolean
  created_at: string
  updated_at: string
}

export interface ProfileResponse {
  id: string
  display_name: string | null
  global_currency: string
  show_usd_toggle: boolean
  drift_notif_channel: string
  alpaca_mode: string
  alpaca_connected: boolean
  bitkub_connected: boolean
  innovestx_equity_connected: boolean
  innovestx_digital_connected: boolean
  schwab_connected: boolean
  schwab_token_expired: boolean
  webull_connected: boolean
  llm_connected: boolean
  llm_provider: string | null
  llm_model: string | null
  active_silo_count: number
  silo_limit: 5
  onboarded: boolean
  progress_banner_dismissed: boolean
  notification_count: number
  created_at: string
}

export function buildProfileResponse(
  row: ProfileRow,
  activeSiloCount: number,
  notificationCount: number,
): ProfileResponse {
  const schwabTokenExpired =
    row.schwab_token_expires !== null
      ? new Date(row.schwab_token_expires) < new Date()
      : false

  return {
    id: row.id,
    display_name: row.display_name,
    global_currency: row.global_currency,
    show_usd_toggle: row.show_usd_toggle,
    drift_notif_channel: row.drift_notif_channel,
    alpaca_mode: row.alpaca_mode,
    alpaca_connected: row.alpaca_key_enc !== null && row.alpaca_secret_enc !== null,
    bitkub_connected: row.bitkub_key_enc !== null && row.bitkub_secret_enc !== null,
    innovestx_equity_connected: row.innovestx_key_enc !== null && row.innovestx_secret_enc !== null,
    innovestx_digital_connected:
      row.innovestx_digital_key_enc !== null && row.innovestx_digital_secret_enc !== null,
    schwab_connected: row.schwab_access_enc !== null && row.schwab_refresh_enc !== null,
    schwab_token_expired: schwabTokenExpired,
    webull_connected: row.webull_key_enc !== null && row.webull_secret_enc !== null,
    llm_connected: row.llm_key_enc !== null,
    llm_provider: row.llm_provider,
    llm_model: row.llm_model,
    active_silo_count: activeSiloCount,
    silo_limit: 5,
    onboarded: row.onboarded,
    progress_banner_dismissed: row.progress_banner_dismissed,
    notification_count: notificationCount,
    created_at: row.created_at,
  }
}
