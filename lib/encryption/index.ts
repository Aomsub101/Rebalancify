/**
 * lib/encryption/index.ts
 *
 * IEncryption interface + singleton adapter.
 * All route and test files import from this index — the interface surfaces
 * every call site at compile time if the adapter ever changes.
 */
import { encrypt, decrypt } from './adapter'

/**
 * Interface for AES-256-GCM symmetric encryption.
 * Preserves the 2-argument call signature (plaintext, key) across all call sites.
 */
export interface IEncryption {
  encrypt(plaintext: string, key: string): string
  decrypt(ciphertext: string, key: string): string
}

export const encryption: IEncryption = { encrypt, decrypt }

export { encrypt, decrypt }
