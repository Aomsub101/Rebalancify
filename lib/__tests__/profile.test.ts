import { describe, it, expect } from 'vitest'
import { buildProfileResponse } from '@/lib/profile'
import type { ProfileRow } from '@/lib/profile'

const baseRow: ProfileRow = {
  id: 'user-uuid',
  display_name: 'Alice',
  global_currency: 'USD',
  show_usd_toggle: false,
  drift_notif_channel: 'both',
  alpaca_key_enc: null,
  alpaca_secret_enc: null,
  alpaca_mode: 'paper',
  bitkub_key_enc: null,
  bitkub_secret_enc: null,
  innovestx_key_enc: null,
  innovestx_secret_enc: null,
  innovestx_digital_key_enc: null,
  innovestx_digital_secret_enc: null,
  schwab_access_enc: null,
  schwab_refresh_enc: null,
  schwab_token_expires: null,
  webull_key_enc: null,
  webull_secret_enc: null,
  llm_provider: null,
  llm_key_enc: null,
  llm_model: null,
  onboarded: false,
  progress_banner_dismissed: false,
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
}

describe('buildProfileResponse', () => {
  it('returns silo_limit: 5 always', () => {
    const result = buildProfileResponse(baseRow, 0, 0)
    expect(result.silo_limit).toBe(5)
  })

  it('includes active_silo_count and notification_count from arguments', () => {
    const result = buildProfileResponse(baseRow, 3, 2)
    expect(result.active_silo_count).toBe(3)
    expect(result.notification_count).toBe(2)
  })

  it('alpaca_connected is false when keys are null', () => {
    const result = buildProfileResponse(baseRow, 0, 0)
    expect(result.alpaca_connected).toBe(false)
  })

  it('alpaca_connected is true when key and secret are present', () => {
    const row = { ...baseRow, alpaca_key_enc: 'enc-key', alpaca_secret_enc: 'enc-secret' }
    const result = buildProfileResponse(row, 0, 0)
    expect(result.alpaca_connected).toBe(true)
  })

  it('bitkub_connected is false when keys are null', () => {
    const result = buildProfileResponse(baseRow, 0, 0)
    expect(result.bitkub_connected).toBe(false)
  })

  it('bitkub_connected is true when keys are present', () => {
    const row = { ...baseRow, bitkub_key_enc: 'enc-key', bitkub_secret_enc: 'enc-secret' }
    const result = buildProfileResponse(row, 0, 0)
    expect(result.bitkub_connected).toBe(true)
  })

  it('innovestx_equity_connected is true when equity keys present', () => {
    const row = { ...baseRow, innovestx_key_enc: 'k', innovestx_secret_enc: 's' }
    const result = buildProfileResponse(row, 0, 0)
    expect(result.innovestx_equity_connected).toBe(true)
  })

  it('innovestx_digital_connected is true when digital keys present', () => {
    const row = { ...baseRow, innovestx_digital_key_enc: 'k', innovestx_digital_secret_enc: 's' }
    const result = buildProfileResponse(row, 0, 0)
    expect(result.innovestx_digital_connected).toBe(true)
  })

  it('schwab_connected is true when access and refresh tokens present', () => {
    const row = { ...baseRow, schwab_access_enc: 'a', schwab_refresh_enc: 'r' }
    const result = buildProfileResponse(row, 0, 0)
    expect(result.schwab_connected).toBe(true)
  })

  it('schwab_token_expired is false when schwab_token_expires is null', () => {
    const result = buildProfileResponse(baseRow, 0, 0)
    expect(result.schwab_token_expired).toBe(false)
  })

  it('schwab_token_expired is true when schwab_token_expires is in the past', () => {
    const row = { ...baseRow, schwab_access_enc: 'a', schwab_refresh_enc: 'r', schwab_token_expires: '2020-01-01T00:00:00Z' }
    const result = buildProfileResponse(row, 0, 0)
    expect(result.schwab_token_expired).toBe(true)
  })

  it('schwab_token_expired is false when schwab_token_expires is in the future', () => {
    const future = new Date(Date.now() + 86400000).toISOString()
    const row = { ...baseRow, schwab_access_enc: 'a', schwab_refresh_enc: 'r', schwab_token_expires: future }
    const result = buildProfileResponse(row, 0, 0)
    expect(result.schwab_token_expired).toBe(false)
  })

  it('webull_connected is true when keys present', () => {
    const row = { ...baseRow, webull_key_enc: 'k', webull_secret_enc: 's' }
    const result = buildProfileResponse(row, 0, 0)
    expect(result.webull_connected).toBe(true)
  })

  it('llm_connected is true when llm_key_enc is present', () => {
    const row = { ...baseRow, llm_key_enc: 'enc-key', llm_provider: 'google', llm_model: 'gemini-2.0-flash' }
    const result = buildProfileResponse(row, 0, 0)
    expect(result.llm_connected).toBe(true)
  })

  it('llm_connected is false when llm_key_enc is null', () => {
    const result = buildProfileResponse(baseRow, 0, 0)
    expect(result.llm_connected).toBe(false)
  })

  it('does not expose any _enc fields in the response', () => {
    const row = { ...baseRow, alpaca_key_enc: 'secret', alpaca_secret_enc: 'also-secret' }
    const result = buildProfileResponse(row, 0, 0)
    const resultStr = JSON.stringify(result)
    expect(resultStr).not.toContain('_enc')
    expect(resultStr).not.toContain('secret')
  })

  it('passes through display_name, global_currency, show_usd_toggle, drift_notif_channel', () => {
    const result = buildProfileResponse(baseRow, 0, 0)
    expect(result.display_name).toBe('Alice')
    expect(result.global_currency).toBe('USD')
    expect(result.show_usd_toggle).toBe(false)
    expect(result.drift_notif_channel).toBe('both')
  })
})
