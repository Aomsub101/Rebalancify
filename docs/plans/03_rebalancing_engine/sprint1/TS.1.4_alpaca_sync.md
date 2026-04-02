# TS.1.4 — Alpaca Sync

## Task
Implement POST /api/silos/:id/sync for Alpaca silos — fetch positions + account cash.

## Target
`app/api/silos/[id]/sync/route.ts`

## Inputs
- TS.1.1-1.2 outputs (encryption + Alpaca credentials)
- `docs/architecture/components/03_rebalancing_engine/11-alpaca_sync.md`

## Process
1. Create `app/api/silos/[id]/sync/route.ts`:
   - Verify silo ownership + platform_type === 'alpaca'
   - Decrypt `alpaca_key_enc` + `alpaca_secret_enc` from user_profiles
   - Determine base URL: paper (`paper-api.alpaca.markets`) or live (`api.alpaca.markets`)
   - Fetch positions: `GET /v2/positions` with Bearer auth
   - Fetch account: `GET /v2/account` for cash balance
   - Upsert holdings: one row per position (source: 'alpaca_sync')
   - Update `silos.cash_balance` with Alpaca account cash
   - Update `silos.last_synced_at` to NOW()
2. All Alpaca API calls are server-side only — zero browser requests
3. Error handling:
   - Alpaca unavailable → HTTP 503 `BROKER_UNAVAILABLE`
   - Invalid credentials → HTTP 401
   - Manual silo → HTTP 422 `MANUAL_SILO_NO_SYNC`

## Outputs
- `app/api/silos/[id]/sync/route.ts` (Alpaca branch)

## Verify
- Sync populates holdings from Alpaca
- Cash balance updated
- last_synced_at updated
- Zero browser requests to alpaca.markets (DevTools check)

## Handoff
→ Sprint 2 (Rebalance calculator)
