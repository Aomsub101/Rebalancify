# TS.3.3 — Webull Sync

## Task
Implement POST /api/silos/:id/sync for Webull — HMAC-SHA256 authenticated positions fetch.

## Target
`app/api/silos/[id]/sync/route.ts` (Webull branch)

## Inputs
- `docs/architecture/components/04_broker_integration_layer/06-webull_sync.md`

## Process
1. Decrypt `webull_key_enc` + `webull_secret_enc`
2. Build HMAC-SHA256 signature over `timestamp + METHOD + path`
   - Timestamp: `Date.now().toString()`
3. Headers: `X-WBL-APIKEY`, `X-WBL-SIGNATURE`, `X-WBL-TIMESTAMP`
4. `GET /v1/account/positions`
5. On network failure → HTTP 503 `BROKER_UNAVAILABLE`
6. On no credentials → HTTP 403 `WEBULL_NOT_CONNECTED`
7. Upsert holdings (source: 'webull_sync', price_source: 'finnhub')
8. Call `fetchPrice()` for each ticker
9. Update `silos.last_synced_at`

## Outputs
- Webull branch in sync route
- `lib/webullClient.ts` (HMAC helper)

## Verify
- Positions fetched via HMAC-authenticated request
- Holdings upserted correctly
- Network failure → 503

## Handoff
→ TS.3.4 (Schwab token expiry)
