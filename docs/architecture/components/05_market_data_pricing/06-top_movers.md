# 06 — Top Movers

## The Goal

Display the top 5 gainers and top 5 losers for US stocks and crypto on the Asset Discovery page, giving users a quick view of market movement without needing to leave Rebalancify.

---

## The Problem It Solves

Investors need market context — what's moving today — to inform their research and rebalancing decisions. Without this feature, users would need to open a separate finance app or website to check market movers. Providing it inside Rebalancify keeps users in context and surfaces relevant tickers for portfolio research.

---

## Implementation Details

**File:** `app/api/market/top-movers/route.ts`

**Query param:** `?type=stocks` or `?type=crypto`

### Stocks — FMP Primary, Finnhub Fallback

**Primary (FMP):**
```
GET https://financialmodelingprep.com/api/v3/gainers?apikey=<FMP_API_KEY>
GET https://financialmodelingprep.com/api/v3/losers?apikey=<FMP_API_KEY>
```
Both called in parallel with `AbortSignal.timeout(8000)`. Response fields: `symbol`, `name`, `price`, `changesPercentage`.

**Fallback (Finnhub):**
```
GET https://finnhub.io/api/v1/scan/technical-indicator?exchange=US&sort=percent_change_desc&token=<FINNHUB_API_KEY>
GET https://finnhub.io/api/v1/scan/technical-indicator?exchange=US&sort=percent_change_asc&token=<FINNHUB_API_KEY>
```
Also called in parallel with 8s timeout. Filters to `percentChange > 0` (gainers) and `< 0` (losers).

### Crypto — CoinGecko

```
GET https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=price_change_percentage_24h_desc&per_page=20&page=1&sparkline=false
GET https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=price_change_percentage_24h_asc&per_page=20&page=1&sparkline=false
```

Both called in parallel with 8s timeout. Results sorted by `price_change_percentage_24h` then sliced to top 5.

### Stale Cache Fallback

If all live sources fail, falls back to stale `price_cache`:
```typescript
const { data: assets } = await supabase.from('assets').select('id, ticker, name').eq('asset_type', type).limit(50)
const { data: prices } = await supabase.from('price_cache').select('asset_id, price').in('asset_id', ids)
```

Returns the first 5 assets from cache with `change_pct: 0` (no daily change available in cache).

### Response Shape

```json
{
  "type": "stocks",
  "stale": false,
  "fetched_at": "2026-04-01T12:00:00.000Z",
  "gainers": [
    { "ticker": "AAPL", "name": "Apple Inc", "price": "185.20000000", "change_pct": 4.215 }
  ],
  "losers": [
    { "ticker": "TSLA", "name": "Tesla Inc", "price": "180.00000000", "change_pct": -3.100 }
  ]
}
```

`change_pct` is a 3dp signed number (positive = gainer, negative = loser). UI renders colour + icon per CLAUDE.md Rule 13.

### Error Responses

| Scenario | HTTP | Body |
|---|---|---|
| Missing `type` param | 400 | `{ error: { code: 'INVALID_TYPE', message: "Query param 'type' must be 'stocks' or 'crypto'" } }` |
| Not authenticated | 401 | `{ error: { code: 'UNAUTHORIZED' } }` |

---

## Testing & Verification

| Check | Method |
|---|---|
| Returns exactly 5 gainers and 5 losers | Manual: `GET /api/market/top-movers?type=stocks` → verify array length |
| `type=stocks` → FMP called first | Manual: mock FMP → verify Finnhub not called |
| `type=crypto` → CoinGecko called | Manual: call with `type=crypto` → verify CoinGecko URLs in network |
| All sources fail → stale cache fallback | Manual: block all three APIs → response has `stale: true` and `change_pct: 0` |
| 8s timeout enforced | Manual: slow mock → verify timeout |
| `change_pct` is signed correctly | Manual: verify gainers > 0, losers < 0 |
| Price as 8dp string | Manual: verify price field has exactly 8 decimal places |
