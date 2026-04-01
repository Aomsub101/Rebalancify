# 05 — Schwab Sync

## The Goal

Fetch the user's Charles Schwab positions using the stored OAuth access token, upsert them as Rebalancify holdings, and return `SCHWAB_TOKEN_EXPIRED` when the token has expired so the UI can prompt re-authentication.

---

## The Problem It Solves

After a user connects Schwab via OAuth, their positions need to be fetched automatically on demand (when they open their Schwab silo) or on explicit sync. The OAuth tokens expire after 7 days; the sync endpoint must detect expiry and surface a clear user-facing error rather than silently failing.

---

## Implementation Details

**Sync function:** `syncSchwab()` in `app/api/silos/[silo_id]/sync/route.ts`

### Pre-Flight Token Expiry Check

```typescript
if (profile.schwab_token_expires !== null && new Date(profile.schwab_token_expires) < new Date()) {
  return NextResponse.json(
    { error: { code: 'SCHWAB_TOKEN_EXPIRED', message: 'Schwab token has expired — reconnect in Settings' } },
    { status: 401 }
  )
}
```

This proactively rejects sync attempts when the refresh token has expired. The user sees the `SCHWAB_TOKEN_EXPIRED` banner in Settings.

### Token Decryption

`schwab_access_enc` is decrypted server-side using `ENCRYPTION_KEY`. The plaintext token is held in memory for the duration of the API call only.

### Positions Fetch

```
GET https://api.schwabapi.com/trader/v1/accounts?fields=positions
Authorization: Bearer <decrypted_access_token>
```

**`parseSchwabPositions(raw)`** iterates all accounts and their positions, filtering to:
- Positions with `longQuantity > 0` (no short positions, no zero-quantity entries)
- Returns `SchwabPosition[]`: `{ symbol, quantity (8dp string), assetType, costBasis }`

### Mid-Session 401 Handling

If Schwab returns HTTP 401 during the positions fetch (access token expired mid-session), the sync also returns `SCHWAB_TOKEN_EXPIRED` with status 401, instructing the UI to prompt re-authentication.

### Holdings Upsert Flow

1. Delete existing `schwab_sync` holdings for this silo
2. Find or create `assets` row (`price_source: 'finnhub'`)
3. Upsert `asset_mappings`
4. Upsert `holdings` with `source: 'schwab_sync'`
5. Call `fetchPrice(supabase, assetId, symbol, 'finnhub')` for each position

### Response

```json
{
  "synced_at": "2026-04-01T12:00:00.000Z",
  "holdings_updated": 12,
  "platform": "schwab"
}
```

---

## Testing & Verification

| Check | Method |
|---|---|
| Token expired → 401 SCHWAB_TOKEN_EXPIRED | Manual: set `schwab_token_expires` to past date → sync returns 401 |
| Mid-session 401 also returns SCHWAB_TOKEN_EXPIRED | Manual: revoke Schwab token → sync returns 401 |
| No plaintext token in response | `grep` for `access_token` / `refresh_token` in route handler output → zero hits |
| Positions upserted with `source: 'schwab_sync'` | Integration test checking `holdings.source` after sync |
| Prices via Finnhub | Manual: verify Finnhub `/quote` called for Schwab tickers |
| RLS isolation | Two-user test: user A's Schwab holdings not visible to user B |
