# TS.2.1 — Next.js Proxy Route

## Task
Create app/api/optimize/route.ts — thin proxy forwarding requests to Railway service.

## Target
`app/api/optimize/route.ts`

## Inputs
- Sprint 1 outputs (Railway service running)
- `docs/architecture/components/10_portfolio_projection_optimization/01-optimizer_api.md`

## Process
1. Create `app/api/optimize/route.ts`:
   - POST handler: validate JWT → forward `{ tickers }` to `${RAILWAY_URL}/optimize`
   - Add `X-API-Key` header with `RAILWAY_API_KEY`
   - `RAILWAY_URL` and `RAILWAY_API_KEY` are server-side only (Vercel env vars)
   - Never exposed to browser bundle
   - Forward response from Railway back to client
2. Error handling:
   - Railway unavailable → HTTP 503 with user-friendly message
   - Railway 422 (too few assets, too short history) → pass through to client
   - Railway timeout (60s Vercel limit) → 504

## Outputs
- `app/api/optimize/route.ts`

## Verify
- Browser calls /api/optimize (not Railway directly)
- RAILWAY_URL/RAILWAY_API_KEY not in browser bundle
- Error passthrough works correctly

## Handoff
→ TS.2.2 (Simulation button)
