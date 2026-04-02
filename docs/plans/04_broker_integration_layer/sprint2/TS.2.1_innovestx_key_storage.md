# TS.2.1 — InnovestX Key Storage

## Task
Extend PATCH /api/profile for both InnovestX credential pairs (equity + digital).

## Target
`app/api/profile/route.ts` (extend)

## Inputs
- Component 03 encryption utility
- `docs/architecture/components/04_broker_integration_layer/03-innovestx_sync.md`

## Process
1. Accept and encrypt two separate credential pairs:
   - Equity (Settrade): `innovestx_key` → `innovestx_key_enc`, `innovestx_secret` → `innovestx_secret_enc`
   - Digital: `innovestx_digital_key` → `innovestx_digital_key_enc`, `innovestx_digital_secret` → `innovestx_digital_secret_enc`
2. GET returns `innovestx_connected: boolean` (true if either pair stored)
3. Each pair can be connected/disconnected independently

## Outputs
- Updated `app/api/profile/route.ts`

## Verify
- Both credential pairs stored independently
- GET returns connection status, never ciphertext

## Handoff
→ TS.2.2 (InnovestX equity sync)
