# TS.1.1 — BITKUB Key Storage

## Task
Extend PATCH /api/profile to encrypt and store BITKUB API credentials.

## Target
`app/api/profile/route.ts` (extend)

## Inputs
- Component 03 TS.1.1 outputs (encryption utility)
- `docs/architecture/components/04_broker_integration_layer/01-broker_encryption.md`

## Process
1. Extend PATCH /api/profile to accept `bitkub_key` + `bitkub_secret`
2. Encrypt both using `encrypt()` from `lib/encryption.ts`
3. Store as `bitkub_key_enc` + `bitkub_secret_enc` in user_profiles
4. GET /api/profile returns `bitkub_connected: boolean` — never the ciphertext
5. To disconnect: PATCH with `{ bitkub_key: null }` → set both to NULL

## Outputs
- Updated `app/api/profile/route.ts`

## Verify
- Save key → `bitkub_connected: true`
- GET never returns ciphertext
- Disconnect → `bitkub_connected: false`

## Handoff
→ TS.1.2 (BITKUB sync)
