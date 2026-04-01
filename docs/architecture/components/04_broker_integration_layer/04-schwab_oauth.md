# 04 — Schwab OAuth

## The Goal

Allow users to connect their Charles Schwab brokerage account via OAuth 2.0 Authorization Code flow, storing encrypted access and refresh tokens so the sync endpoint can fetch positions on their behalf.

---

## The Problem It Solves

Charles Schwab does not offer API keys. It uses OAuth 2.0 — the standard flow where a user grants access in a browser redirect, and the platform receives an authorization code that is exchanged for short-lived access tokens (30 minutes) and longer-lived refresh tokens (7 days). Without this flow, Schwab cannot be integrated at all.

---

## Implementation Details

### OAuth Initiation — `GET /api/auth/schwab`

- Requires authentication (user must be logged in)
- Checks `SCHWAB_CLIENT_ID` env var — returns 503 if not configured
- Generates UUID v4 as CSRF state token
- Stores state in HTTP-only cookie (`schwab_oauth_state`, 60-min TTL, `sameSite: 'lax'`)
- Redirects to `https://api.schwabapi.com/v1/oauth/authorize` with `response_type=code`, `client_id`, `redirect_uri`, `state`

### OAuth Callback — `GET /api/auth/schwab/callback`

**CSRF validation:**
- Reads `schwab_oauth_state` cookie
- Compares with `state` query param
- Mismatch → redirects to `/settings?schwab_error=state_mismatch`
- Missing or expired cookie → redirect with appropriate error

**Token exchange:**
```
POST https://api.schwabapi.com/v1/oauth/token
Authorization: Basic base64(clientId:clientSecret)
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code=<auth_code>&redirect_uri=<callback_url>
```

**Token storage:**
- `access_token` encrypted → `schwab_access_enc`
- `refresh_token` encrypted → `schwab_refresh_enc`
- `schwab_token_expires = NOW() + 7 days`

**On error:** Redirects to `/settings?schwab_error=<reason>`. Error reasons include: `access_denied` (user cancelled), `missing_code`, `state_mismatch`, `not_configured`, `token_exchange_failed`, `invalid_token_response`, `network_error`, `storage_failed`.

**On success:** Redirects to `/settings?schwab_connected=true`. Clears the CSRF cookie.

### Encrypted Storage

All tokens are encrypted with AES-256-GCM (`lib/encryption.ts`) before being written to `user_profiles`. The plaintext tokens are held in memory only during the callback request — never logged, never returned in API responses.

---

## Security Properties

| Property | How Enforced |
|---|---|
| CSRF protection | State cookie validated against `state` query param on callback |
| Token confidentiality | AES-256-GCM encryption before database write |
| Token authenticity | GCM auth tag detects any ciphertext tampering |
| No browser token exposure | Tokens stored server-side only; browser receives only `schwab_connected=true` |
| Replay protection | Auth codes are one-time use (Schwab's OAuth server) |
| Token expiry tracking | `schwab_token_expires` enables proactive re-auth prompts |

---

## Testing & Verification

| Check | Method |
|---|---|
| CSRF state mismatch → callback rejected | Manual: tamper `state` param → redirect with `schwab_error=state_mismatch` |
| Tokens encrypted before storage | Unit test: intercept PATCH payload, verify no plaintext tokens |
| `schwab_connected: true` after successful OAuth | Manual: complete OAuth flow → GET /api/profile shows `schwab_connected: true` |
| `schwab_token_expires` set to 7 days | Check `user_profiles.schwab_token_expires` after OAuth |
| Access token never in response | `grep` for `access_token` in GET /api/profile → zero hits |
