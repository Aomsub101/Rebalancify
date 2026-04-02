# TS.1.2 — Alpaca Key Storage

## Task
Extend PATCH /api/profile to handle Alpaca key/secret encryption and storage.

## Target
`app/api/profile/route.ts` (extend existing)

## Inputs
- TS.1.1 outputs (encryption utility)
- `docs/architecture/components/03_rebalancing_engine/01-encryption.md`

## Process
1. Extend PATCH /api/profile to accept:
   - `alpaca_key` → encrypt → store as `alpaca_key_enc`
   - `alpaca_secret` → encrypt → store as `alpaca_secret_enc`
   - `alpaca_mode` → store directly ('paper' | 'live')
2. GET /api/profile returns:
   - `alpaca_connected: boolean` (true if alpaca_key_enc is not null)
   - `alpaca_mode: string`
   - **Never** return `alpaca_key_enc` or `alpaca_secret_enc`
3. To disconnect: PATCH with `{ alpaca_key: null }` → set both `*_enc` to NULL

## Outputs
- Updated `app/api/profile/route.ts`

## Verify
- Save key → GET returns `alpaca_connected: true`
- GET never returns ciphertext
- Disconnect → `alpaca_connected: false`

## Handoff
→ TS.1.3 (Alpaca settings UI)
