# TS.1.2 — BITKUB Sync

## Task
Implement POST /api/silos/:id/sync for BITKUB — fetch wallet + ticker via HMAC-SHA256.

## Target
`app/api/silos/[id]/sync/route.ts` (BITKUB branch)

## Inputs
- TS.1.1 outputs (BITKUB credentials stored)
- `docs/architecture/components/04_broker_integration_layer/02-bitkub_sync.md`

## Process
1. Add BITKUB branch to sync route (when `platform_type === 'bitkub'`):
   - Decrypt `bitkub_key_enc` + `bitkub_secret_enc`
   - In parallel:
     - Public ticker: `GET /api/v2/market/ticker` (no auth)
     - Authenticated wallet: `POST /api/v2/market/wallet` with HMAC-SHA256 signature
   - HMAC signature: `SHA256(timestamp + POST + /api/v2/market/wallet + body, secret)`
   - Parse non-zero balances (excluding THB) as holdings
   - THB balance → `silos.cash_balance`
   - Upsert holdings (source: 'bitkub_sync'), delete stale non-bitkub_sync rows first
   - Upsert price_cache entries from ticker map (THB prices, source: 'bitkub')
   - Update `silos.last_synced_at`
2. Error: BITKUB unreachable → HTTP 503 `BROKER_UNAVAILABLE`
3. Error: No credentials → HTTP 403 `BITKUB_NOT_CONNECTED`

## Outputs
- Updated `app/api/silos/[id]/sync/route.ts` (BITKUB branch)
- `lib/bitkubClient.ts` (HMAC signature helper)

## Verify
- Sync populates holdings from BITKUB wallet
- THB cash balance updated
- Price cache populated from ticker data

## Handoff
→ TS.1.3 (BITKUB price cache)
