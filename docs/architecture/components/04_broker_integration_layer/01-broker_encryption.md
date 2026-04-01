# 01 — Broker Encryption

## The Goal

Protect all broker API credentials (keys, secrets, OAuth tokens) so that a database leak alone cannot expose live brokerage access. Plaintext credentials must never appear in API responses, browser bundles, logs, or error messages.

---

## The Problem It Solves

Without encryption, API keys stored in `user_profiles` would be readable by anyone with database access. Rebalancify stores credentials for Alpaca, BITKUB, InnovestX, Schwab, and Webull — all of which can execute real trades. A single breach of the database would give attackers direct access to execute orders on a user's behalf.

---

## The Proposed Solution

AES-256-GCM (Advanced Encryption Standard with Galois/Counter Mode) provides both confidentiality and authenticity:

- **Confidentiality:** The 256-bit key ensures ciphertext cannot be decrypted without the key.
- **Authenticity:** The auth tag ensures ciphertext has not been tampered with. Any modification is detected on decryption.

Every encryption operation generates a fresh 12-byte random IV (Initialization Vector), ensuring identical plaintexts produce different ciphertexts — preventing correlation attacks.

---

## Implementation Details

**Library:** `lib/encryption.ts`

**Format:** `iv_b64:authTag_b64:ciphertext_b64` (three colon-separated base64 segments)

**Key requirement:** `ENCRYPTION_KEY` must be a 64-character hex string (32 bytes). Set via Vercel environment variable. Rotate by re-encrypting all values with the new key.

### encrypt(plaintext, keyHex) → string

```typescript
// iv = 12 random bytes, authTag = 16 bytes, ciphertext = plaintext
return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':')
```

### decrypt(ciphertext, keyHex) → string

Throws `Error("Invalid ciphertext format")` if the ciphertext has been altered.

---

## Where It Is Used

| File | What Gets Encrypted |
|---|---|
| `app/api/profile/route.ts` PATCH | `alpaca_key`, `alpaca_secret` → `alpaca_key_enc` / `alpaca_secret_enc` |
| `app/api/profile/route.ts` PATCH | `bitkub_key`, `bitkub_secret` → `bitkub_key_enc` / `bitkub_secret_enc` |
| `app/api/profile/route.ts` PATCH | `innovestx_key`, `innovestx_secret` → `innovestx_key_enc` / `innovestx_secret_enc` |
| `app/api/profile/route.ts` PATCH | `innovestx_digital_key`, `innovestx_digital_secret` → `innovestx_digital_key_enc` / `innovestx_digital_secret_enc` |
| `app/api/profile/route.ts` PATCH | `webull_key`, `webull_secret` → `webull_key_enc` / `webull_secret_enc` |
| `app/api/profile/route.ts` PATCH | `llm_key` → `llm_key_enc` (Component 8) |
| `app/api/auth/schwab/callback/route.ts` | Schwab `access_token` + `refresh_token` → `schwab_access_enc` / `schwab_refresh_enc` |

---

## Security Rules Enforced

1. **No `_enc` column ever returned in GET responses.** `lib/profile.ts`'s `buildProfileResponse()` strips all `*_enc` columns and replaces them with `*_connected: bool`.
2. **Decryption happens only in route handlers** — never in client components or shared libraries called by the browser.
3. **Decryption failures are opaque** — the route returns HTTP 500 `DECRYPTION_FAILED` with no details about the key or ciphertext.
4. **All broker HTTP calls are server-side** (`cache: 'no-store'`, no API URLs ever reach the browser).

---

## Testing & Verification

| Check | Method |
|---|---|
| Round-trip: encrypt → decrypt returns original | Unit test in `lib/*.test.ts` |
| IV uniqueness: same value encrypted twice → different ciphertexts | Unit test |
| No `_enc` fields in any GET response | `grep` for `_enc` in route responses |
| Keys never logged | `grep` for `console.log` near decryption calls → zero hits |
| Browser never calls broker API domains | DevTools Network tab during sync |
