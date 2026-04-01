# 03 — InnovestX Dual-Branch Sync

## The Goal

Sync holdings from both InnovestX sub-accounts — Thai equities via Settrade Open API and digital assets via the InnovestX Digital Asset API — as independent operations. One branch can fail or be unconfigured without blocking the other.

---

## The Problem It Solves

InnovestX exposes two completely separate APIs with different authentication schemes:

- **Settrade Open API** (Thai equities): OAuth 2.0 client_credentials, App ID + App Secret → Bearer token
- **InnovestX Digital Asset API** (crypto): HMAC-SHA256 request signatures over a compound message

Users may have access to one, both, or neither of these sub-accounts. The sync must handle each independently.

---

## Implementation Details

**Sync function:** `syncInnovestx()` in `app/api/silos/[silo_id]/sync/route.ts`

**Helper library:** `lib/innovestx.ts`

### Equity Branch (Settrade OAuth)

**Step 1 — Auth:**
```
POST https://open-api.settrade.com/api/ords/SETTrade/oauth/token
Authorization: Basic base64(appId:appSecret)
Body: grant_type=client_credentials
```

**Step 2 — Account lookup:**
```
GET https://open-api.settrade.com/api/ords/SETTrade/Investor/Account
Authorization: Bearer <access_token>
```

**Step 3 — Portfolio:**
```
GET https://open-api.settrade.com/api/ords/SETTrade/Investor/Account/<accountNo>/Portfolio
Authorization: Bearer <access_token>
```

Returns `portfolioList: [{ symbol: "PTT", volume: 100 }, ...]`

**Price source:** Finnhub (Tier 2 in the price service). Each holding triggers `fetchPrice(supabase, assetId, ticker, 'finnhub')`.

### Digital Asset Branch (HMAC-SHA256)

**Signature message format:**
```
apiKey + METHOD + host + path + query + contentType + requestUid + timestamp + body
```

Example:
```
abc123GETapi.innovestxonline.com/api/v1/digital-asset/account/balance/inquir...application/jsonuuid-ts-body
```

**`buildInnovestxDigitalSignature(...)`** produces a 64-character lowercase hex HMAC-SHA256 digest.

**Request headers:**
- `X-INVX-APIKEY`: the API key
- `X-INVX-SIGNATURE`: the computed HMAC hex digest
- `X-INVX-TIMESTAMP`: Unix timestamp in milliseconds (string)
- `X-INVX-REQUEST-UID`: UUID v4, unique per request

**`parseInnovestxDigitalBalances(raw)`** — extracts `{ product, amount }` entries where `amount > 0`.

**Price source:** CoinGecko (Tier 3 in the price service).

### Branch Independence

Each branch checks for its own credentials before executing. If `innovestx_key_enc` is null, the equity branch is skipped and `sync_warnings` gets an entry. Same for the digital branch. The two branches are fully isolated — a failure in one cannot cause the other to fail.

### Holdings Upsert Flow

For both branches:
1. Delete existing `innovestx_sync` holdings for this silo
2. Find or create `assets` row (`price_source: 'finnhub'` for equity, `'coingecko'` for digital)
3. Upsert `asset_mappings`
4. Upsert `holdings` with `source: 'innovestx_sync'`
5. Call `fetchPrice()` for each position

### Response

```json
{
  "synced_at": "2026-04-01T12:00:00.000Z",
  "holdings_updated": 7,
  "platform": "innovestx",
  "sync_warnings": [
    "InnovestX Digital Asset credentials not configured — digital sync skipped"
  ]
}
```

`sync_warnings` is omitted if both branches succeeded.

---

## Testing & Verification

| Check | Method |
|---|---|
| Equity credentials only → digital branch skipped with warning | Manual: set only `innovestx_key/secret` → `sync_warnings` includes digital skip |
| Both credentials present → both branches run | Integration test |
| Equity prices via Finnhub | Manual: verify Finnhub `/quote` called for Thai tickers |
| Digital prices via CoinGecko | Manual: verify CoinGecko `/simple/price` called for digital assets |
| HMAC-SHA256 signature | Unit test against InnovestX API docs test vectors |
| Independent failure | Manual: digital creds invalid → equity branch still succeeds |
