# 02 — BITKUB Sync

## The Goal

Fetch a user's BITKUB crypto holdings and THB cash balance, store them as Rebalancify holdings, and simultaneously populate the price cache with THB prices — all in a single authenticated API call per sync.

---

## The Problem It Solves

Users with crypto on BITKUB (a Thai exchange) need their holdings reflected automatically in Rebalancify without manual entry. BITKUB is the native price source for THB-quoted pairs, so price data must also be captured during sync rather than fetched separately.

---

## Implementation Details

**Sync function:** `syncBitkub()` in `app/api/silos/[silo_id]/sync/route.ts`

**Helper library:** `lib/bitkub.ts`

### Authentication

BITKUB uses HMAC-SHA256 request signing. The `buildBitkubSignature(payloadJson, secret)` helper computes the `X-BTK-SIGN` header value:

```
signature = HMAC-SHA256(secret, JSON.stringify({ ts: Date.now() }))
```

The request body must match the signature payload exactly — both use the same `ts` (Unix timestamp in milliseconds).

### API Calls (executed in parallel)

1. **Public ticker:** `GET https://api.bitkub.com/api/v2/market/ticker`
   - Returns all THB-quoted pairs as a map: `{ "THB_BTC": { last: 18234.5 }, ... }`
   - No authentication required

2. **Authenticated wallet:** `POST https://api.bitkub.com/api/v2/market/wallet`
   - Headers: `X-BTK-APIKEY`, `X-BTK-SIGN`, `Content-Type: application/json`
   - Body: `{"ts": <timestamp>}`

### Parsing

**`parseBitkubTicker(raw)`** — converts the raw ticker map to `BitkubTickerEntry[]`:
- Filters to keys starting with `THB_`, strips the prefix
- Returns `symbol` (e.g. `"BTC"`) and `priceThb` as an 8dp string

**`parseBitkubWallet(raw)`** — returns a tuple:
- `[0]` — `BitkubHolding[]`: all assets with non-zero balance, excluding THB
- `[1]` — `thbBalance` as 8dp string (THB cash)

### Holdings Upsert Flow

1. Delete existing `bitkub_sync` holdings for this silo (removes legacy rows before fresh sync)
2. For each holding: find or create `assets` row (`ticker`, `name`, `asset_type: 'crypto'`, `price_source: 'bitkub'`)
3. Upsert `asset_mappings` (`silo_id, asset_id`)
4. Upsert `holdings` (`silo_id, asset_id, quantity, source: 'bitkub_sync'`)
5. Upsert `price_cache` with THB price and `source: 'bitkub'`

### Response

```json
{
  "synced_at": "2026-04-01T12:00:00.000Z",
  "holdings_updated": 3,
  "cash_balance": "15000.00000000",
  "platform": "bitkub"
}
```

On failure: HTTP 503 `BROKER_UNAVAILABLE`.

---

## Testing & Verification

| Check | Method |
|---|---|
| BITKUB ticker updates price_cache during sync | Integration test checking `price_cache` rows after sync |
| Non-zero balance assets only | Unit test: wallet result with `THB: 0` is excluded |
| Parallel fetch of ticker + wallet | Code review: `Promise.all` in `syncBitkub()` |
| `source` set correctly to `bitkub_sync` | Integration test checking `holdings.source` |
| 503 on network error | Manual: block `api.bitkub.com` → sync returns 503 |
