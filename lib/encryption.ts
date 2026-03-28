/**
 * lib/encryption.ts
 * AES-256-GCM symmetric encryption helpers.
 *
 * Usage:
 *   const enc = encrypt(plaintext, process.env.ENCRYPTION_KEY!)
 *   const dec = decrypt(enc, process.env.ENCRYPTION_KEY!)
 *
 * Format: "iv_b64:authTag_b64:data_b64"  (colon-separated base64 segments)
 *
 * SECURITY RULES (CLAUDE.md Rule 4):
 * - Never log ciphertexts or keys.
 * - Always decrypt server-side; never return plaintexts or _enc columns.
 * - ENCRYPTION_KEY must be a cryptographically random 32-byte hex string.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12   // 96-bit IV — recommended for GCM
const TAG_LENGTH = 16  // 128-bit auth tag

function keyBuffer(keyHex: string): Buffer {
  if (keyHex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  return Buffer.from(keyHex, 'hex')
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns "iv_b64:authTag_b64:ciphertext_b64".
 */
export function encrypt(plaintext: string, keyHex: string): string {
  const key = keyBuffer(keyHex)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

/**
 * Decrypts a value produced by encrypt().
 * Throws if the key is wrong or the ciphertext has been tampered with.
 */
export function decrypt(ciphertext: string, keyHex: string): string {
  const key = keyBuffer(keyHex)
  const parts = ciphertext.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format')
  }
  const [ivB64, authTagB64, dataB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')
  const data = Buffer.from(dataB64, 'base64')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag.subarray(0, TAG_LENGTH))

  const decrypted = Buffer.concat([
    decipher.update(data),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}
