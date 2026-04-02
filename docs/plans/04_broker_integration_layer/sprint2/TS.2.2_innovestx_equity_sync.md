# TS.2.2 — InnovestX Equity Sync (Settrade OAuth)

## Task
Implement the Settrade equity branch of InnovestX sync.

## Target
`app/api/silos/[id]/sync/route.ts` (InnovestX branch — equity)

## Inputs
- TS.2.1 outputs (InnovestX credentials)
- `docs/architecture/components/04_broker_integration_layer/03-innovestx_sync.md`

## Process
1. Settrade OAuth flow:
   - Decrypt `innovestx_key_enc` + `innovestx_secret_enc` (App ID + App Secret)
   - `POST /api/ords/SETTrade/oauth/token` with Basic Auth → access token
   - `GET /api/ords/SETTrade/Investor/Account` → account number
   - `GET /api/ords/SETTrade/Investor/Account/{accountNo}/Portfolio` → positions
2. Upsert holdings (source: 'innovestx_sync', price_source: 'finnhub')
3. Delete stale non-innovestx_sync rows first
4. Call `fetchPrice()` for each ticker via Finnhub
5. If equity credentials absent: skip with warning in `sync_warnings[]`

## Outputs
- InnovestX equity branch in sync route
- `lib/innovestxClient.ts` (Settrade OAuth helper)

## Verify
- Equity positions fetched and upserted
- Prices fetched via Finnhub
- Missing credentials → warning, not error

## Handoff
→ TS.2.3 (InnovestX digital sync)
