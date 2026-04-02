# TS.2.3 — InnovestX Digital Asset Sync (HMAC-SHA256)

## Task
Implement the digital asset branch of InnovestX sync.

## Target
`app/api/silos/[id]/sync/route.ts` (InnovestX branch — digital)

## Inputs
- TS.2.1 outputs (InnovestX digital credentials)
- `docs/architecture/components/04_broker_integration_layer/03-innovestx_sync.md`

## Process
1. HMAC-SHA256 authentication:
   - Decrypt `innovestx_digital_key_enc` + `innovestx_digital_secret_enc`
   - Build signature: `apiKey + METHOD + host + path + query + contentType + requestUid + timestamp + body`
   - Headers: `X-INVX-SIGNATURE`, `X-INVX-APIKEY`, `X-INVX-TIMESTAMP`, `X-INVX-REQUEST-UID`
   - `GET /api/v1/digital-asset/account/balance/inquiry`
2. Upsert holdings (source: 'innovestx_sync', price_source: 'coingecko')
3. Delete stale non-innovestx_sync digital rows first
4. Call `fetchPrice()` for each asset via CoinGecko
5. If digital credentials absent: skip with warning in `sync_warnings[]`
6. Both branches run in sequence; if one fails, the other still executes

## Outputs
- InnovestX digital branch in sync route
- Extended `lib/innovestxClient.ts` (HMAC signature helper)

## Verify
- Digital asset balances fetched and upserted
- Prices fetched via CoinGecko
- One branch failure doesn't block the other

## Handoff
→ Sprint 3 (Schwab + Webull)
