import { describe, expect, it, vi } from 'vitest'
import { buildProfileUpdatePayload } from '@/lib/profileApi'

describe('buildProfileUpdatePayload', () => {
  it('returns an INVALID_VALUE response for bad drift_notif_channel', async () => {
    const result = buildProfileUpdatePayload({ drift_notif_channel: 'bad' }, undefined)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected validation failure')

    const body = await result.response.json()
    expect(body.error.code).toBe('INVALID_VALUE')
    expect(body.error.message).toContain('drift_notif_channel')
  })

  it('encrypts InnovestX credentials and never returns plaintext', () => {
    const result = buildProfileUpdatePayload(
      { innovestx_key: 'plain-key', innovestx_secret: 'plain-secret' },
      'a'.repeat(64),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected success result')

    expect(result.data.innovestx_key_enc).toBeTypeOf('string')
    expect(result.data.innovestx_secret_enc).toBeTypeOf('string')
    expect(result.data.innovestx_key_enc).not.toBe('plain-key')
    expect(result.data.innovestx_secret_enc).not.toBe('plain-secret')
  })

  it('returns an ENCRYPTION_KEY_MISSING response when encrypted fields are provided without a key', async () => {
    const result = buildProfileUpdatePayload({ alpaca_key: 'abc' }, undefined)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected encryption failure')

    const body = await result.response.json()
    expect(body.error.code).toBe('ENCRYPTION_KEY_MISSING')
  })
})
