# TS.1.1 — Encryption Utility

## Task
Implement AES-256-GCM encrypt/decrypt utility for broker credential storage.

## Target
`lib/encryption.ts`

## Inputs
- `docs/architecture/components/03_rebalancing_engine/01-encryption.md`
- `ENCRYPTION_KEY` env var (64-char hex = 32 bytes)

## Process
1. Create `lib/encryption.ts`:
   - `encrypt(plaintext: string): string` — AES-256-GCM with random 12-byte IV
     - Output format: `iv_b64:authTag_b64:ciphertext_b64`
     - Each encryption produces unique output (fresh IV per call)
   - `decrypt(encrypted: string): string` — parse the three parts, decrypt
   - Read `ENCRYPTION_KEY` from `process.env` (Vercel env var)
   - Throw `ENCRYPTION_KEY_MISSING` if env var not set
   - Throw `DECRYPTION_FAILED` if ciphertext tampered
2. Key handling:
   - Convert 64-char hex string to 32-byte Buffer
   - Never log plaintext or key material
   - Never return plaintext in any API response

## Outputs
- `lib/encryption.ts`

## Tests
- Unit test: encrypt → decrypt → original value
- Unit test: same plaintext produces different ciphertexts (fresh IV)
- Unit test: tampered ciphertext → DECRYPTION_FAILED error
- Unit test: missing ENCRYPTION_KEY → ENCRYPTION_KEY_MISSING error

## Verify
- Round-trip works for various string lengths
- No plaintext in logs or responses

## Handoff
→ TS.1.2 (Alpaca key storage uses encryption)
