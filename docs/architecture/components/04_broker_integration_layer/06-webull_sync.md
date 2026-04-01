# 06 — Webull Sync

## The Goal

Fetch a user's Webull positions using an API key + HMAC-SHA256 signature, store them as Rebalancify holdings, and surface appropriate error codes when Webull is unreachable or credentials are missing.

---

## The Problem It Solves

Webull provides a proprietary API requiring HMAC-SHA256 request signatures. Like BITKUB, the signature is built from a timestamp + HTTP method + request path. Without this integration, Webull users cannot see their positions automatically in Rebalancify.

---

## Implementation Details

**Sync function:** `syncWebull()` in `app/api/silos/[silo_id]/sync/route.ts`

**Helper library:** `lib/webull.ts`

### Authentication — HMAC-SHA256

The signature covers: `timestamp + METHOD.toUpperCase() + path`

```
timestamp = Date.now().toString()  // Unix ms timestamp
method   = 'GET'
path     = '/v1/account/positions'
message  = '1743501234567GET/v1/account/positions'
signature = HMAC-SHA256(webull_secret, message).digest('hex')
```

**Request headers:**
- `X-WBL-APIKEY`: the API key
- `X-WBL-SIGNATURE`: the computed hex digest
- `X-WBL-TIMESTAMP`: the Unix ms timestamp string

### Parsing — `parseWebullPositions(raw)`

Iterates `data[]` array in the response, extracting:
- `ticker.symbol` → ticker name
- `position` → quantity as string
- `costPrice` → cost basis (nullable)
- `ticker.type === 'CRYPTO'` → asset type `'crypto'`, else `'stock'`

Positions with zero or missing quantities are filtered out.

### Holdings Upsert Flow

1. Delete existing `webull_sync` holdings for this silo
2. Find or create `assets` row (`price_source: 'finnhub'`, `asset_type` from `ticker.type`)
3. Upsert `asset_mappings`
4. Upsert `holdings` with `source: 'webull_sync'`
5. Call `fetchPrice(supabase, assetId, ticker, 'finnhub')` for each position (Webull holds US stocks, so Finnhub is the price source)

### Error Handling

- Missing credentials → HTTP 403 `WEBULL_NOT_CONNECTED`
- Decryption failure → HTTP 500 `DECRYPTION_FAILED`
- Network error → HTTP 503 `BROKER_UNAVAILABLE`

### Advisory Notice

The Settings page Webull section includes a UI-only advisory: "Webull requires a minimum account value of $500." This is not enforced backend-side — if a Webull account is below $500, Webull's own API returns an error that is surfaced as `BROKER_UNAVAILABLE`.

---

## Testing & Verification

| Check | Method |
|---|---|
| HMAC-SHA256 signature | Unit test against known test vectors |
| Zero quantity positions excluded | Unit test: `position: "0"` → not in result |
| `source` = `webull_sync` | Integration test checking `holdings.source` |
| Prices via Finnhub | Manual: verify Finnhub `/quote` called for Webull tickers |
| 503 on Webull API error | Manual: block `api.webull.com` → sync returns 503 |
| RLS isolation | Two-user test: user A's Webull holdings not visible to user B |
