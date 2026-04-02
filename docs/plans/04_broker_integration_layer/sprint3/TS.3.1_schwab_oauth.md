# TS.3.1 — Schwab OAuth Flow

## Task
Implement Schwab OAuth initiation and callback with CSRF protection and token encryption.

## Target
`app/api/auth/schwab/route.ts`, `app/api/auth/schwab/callback/route.ts`

## Inputs
- `docs/architecture/components/04_broker_integration_layer/04-schwab_oauth.md`

## Process
1. **GET /api/auth/schwab** (initiation):
   - Generate UUID v4 CSRF state token
   - Store in HTTP-only cookie (60-min TTL)
   - Redirect to `https://api.schwabapi.com/v1/oauth/authorize` with client_id + redirect_uri + state
2. **GET /api/auth/schwab/callback:**
   - Validate CSRF: state cookie matches `state` query param
   - Exchange authorization code for tokens: `POST /v1/oauth/token` with Basic Auth (clientId:clientSecret)
   - Encrypt both `access_token` and `refresh_token`
   - Store: `schwab_access_enc`, `schwab_refresh_enc`, `schwab_token_expires = now + 7 days`
   - Clear CSRF cookie
   - Redirect to `/settings?schwab_connected=true`
3. Env vars: `SCHWAB_CLIENT_ID`, `SCHWAB_CLIENT_SECRET`, `SCHWAB_REDIRECT_URI`

## Outputs
- `app/api/auth/schwab/route.ts`
- `app/api/auth/schwab/callback/route.ts`

## Verify
- Full OAuth flow: initiate → authorize → callback → tokens stored
- CSRF mismatch → rejected
- GET /api/profile shows `schwab_connected: true`

## Handoff
→ TS.3.2 (Schwab sync)
