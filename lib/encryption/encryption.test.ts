/**
 * lib/encryption/encryption.test.ts
 * TDD unit tests for AES-256-GCM encryption helpers (adapter pattern).
 * Per docs/development/03-testing-strategy.md — 3 required tests:
 *   1. Encrypt → decrypt round trip produces original plaintext.
 *   2. Two encryptions of the same plaintext produce different ciphertexts (IV uniqueness).
 *   3. Decrypt with wrong key throws an error.
 */
import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from './adapter'

// 32-byte hex key for tests only. Never use this outside tests.
const TEST_KEY = 'a'.repeat(64)
const WRONG_KEY = 'b'.repeat(64)

describe('encryption adapter', () => {
  it('encrypt → decrypt round trip produces original plaintext', () => {
    const plaintext = 'PKTEST12345'
    const ciphertext = encrypt(plaintext, TEST_KEY)
    expect(decrypt(ciphertext, TEST_KEY)).toBe(plaintext)
  })

  it('two encryptions of the same plaintext produce different ciphertexts (IV uniqueness)', () => {
    const plaintext = 'same-plaintext'
    const ct1 = encrypt(plaintext, TEST_KEY)
    const ct2 = encrypt(plaintext, TEST_KEY)
    expect(ct1).not.toBe(ct2)
  })

  it('decrypt with wrong key throws an error', () => {
    const ciphertext = encrypt('some secret', TEST_KEY)
    expect(() => decrypt(ciphertext, WRONG_KEY)).toThrow()
  })
})
