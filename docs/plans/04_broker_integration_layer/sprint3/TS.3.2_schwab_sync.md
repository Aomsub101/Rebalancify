# TS.3.2 — Schwab Sync

## Task
Implement POST /api/silos/:id/sync for Schwab — fetch accounts and positions.

## Target
`app/api/silos/[id]/sync/route.ts` (Schwab branch)

## Inputs
- TS.3.1 outputs (Schwab tokens stored)
- `docs/architecture/components/04_broker_integration_layer/05-schwab_sync.md`

## Process
1. Check `schwab_token_expires < NOW()` → HTTP 401 `SCHWAB_TOKEN_EXPIRED`
2. Decrypt `schwab_access_enc`
3. Fetch `GET /trader/v1/accounts?fields=positions` with Bearer token
4. On Schwab HTTP 401 → return `SCHWAB_TOKEN_EXPIRED` (user must re-authenticate)
5. Parse positions into holdings
6. Upsert holdings (source: 'schwab_sync', price_source: 'finnhub')
7. Call `fetchPrice()` for each ticker via Finnhub
8. Update `silos.last_synced_at`

## Outputs
- Schwab branch in `app/api/silos/[id]/sync/route.ts`
- `lib/schwabClient.ts`

## Verify
- Positions fetched and upserted correctly
- Expired token → 401 with clear error
- Prices fetched via Finnhub

## Handoff
→ TS.3.3 (Webull sync)
