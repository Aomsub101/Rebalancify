# Sub-Component: API — Market Top Movers

## 1. The Goal

Serve the top 5 gainers and top 5 losers for either US stocks or crypto. US stocks are sourced from Finnhub or FMP; crypto is sourced from CoinGecko (no API key required). When external sources fail, cached data is returned with a `stale: true` flag so the UI can indicate staleness without blocking the user.

---

## 2. The Problem It Solves

Market movers data is inherently volatile — external APIs may be rate-limited, return errors, or be under maintenance. The endpoint must gracefully degrade: return stale cached data rather than surfacing an error to the user. This keeps the Discover page functional at all times.

---

## 3. The Proposed Solution / Underlying Concept

### US Stocks Path

```
GET /api/market/top-movers?type=stocks
→ Finnhub /stock/peers?ticker={top_tickers}  (or FMP as fallback)
→ Returns top 5 gainers + top 5 losers by daily_change_pct
```

If Finnhub fails → FMP is tried as fallback. If both fail → stale cache.

### Crypto Path

```
GET /api/market/top-movers?type=crypto
→ CoinGecko /coins/markets?vs_currency=usd&order=percent_change_24h
→ Returns top gainers/losers sorted by 24h change
```

CoinGecko does not require an API key and has a generous free tier.

### Stale-Cache Fallback

When both primary and fallback sources fail:
1. Read last cached result from `price_cache` (or a dedicated `top_movers_cache` table/record)
2. Return the cached data with `stale: true` added to the response
3. No error is thrown; the API always returns 200

### Response Shape

```typescript
interface TopMoverAsset {
  ticker: string;
  name: string;
  current_price: string; // NUMERIC(20,8) as string
  daily_change_pct: number; // e.g., 2.34 or -1.87
}

interface TopMoversResponse {
  gainers: TopMoverAsset[];
  losers: TopMoverAsset[];
  stale?: true; // present only when using stale cache
}
```

### Non-Colour Signals

The API does not embed colour information — this is the UI's responsibility. The component spec requires `TrendingUp` + green for gainers and `TrendingDown` + red for losers.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| `type=stocks` returns 5 gainers + 5 losers | Unit: call endpoint → assert `gainers.length === 5 && losers.length === 5` |
| `type=crypto` returns 5 gainers + 5 losers | Unit: call endpoint → assert correct count |
| `stale: true` on source failure | Mock Finnhub + FMP failure → assert `response.stale === true` |
| `daily_change_pct` is a number | Unit: assert `typeof asset.daily_change_pct === "number"` |
| `current_price` is string | Unit: assert `typeof asset.current_price === "string"` |
| Gainers sorted descending | Unit: assert `gainers[0].daily_change_pct > gainers[4].daily_change_pct` |
| Losers sorted ascending (most negative first) | Unit: assert `losers[0].daily_change_pct < losers[4].daily_change_pct` |
