# Sub-Component: API — Assets Peers

## 1. The Goal

Serve peer asset data for any given ticker — 5–8 related companies in the same sector — to power the Discover page's peer grid. The endpoint uses Finnhub as the primary source and falls back to a static `sector_taxonomy.json` file when Finnhub is unavailable.

---

## 2. The Problem It Solves

Finnhub's `/stock/peers` endpoint returns peer tickers for a given company. However, Finnhub may be rate-limited, have API key issues, or be temporarily unavailable. The static taxonomy fallback ensures the peer discovery feature never shows an error to the user — it always returns a meaningful result.

---

## 3. The Proposed Solution / Underlying Concept

### Primary: Finnhub

```
GET /api/assets/:id/peers
→ calls Finnhub /stock/peers?ticker={ticker}
→ Finnhub returns: ["AAPL", "MSFT", "GOOGL", ...]
```

For each returned peer ticker, `price_cache` is queried for `current_price`. The final response contains `{ ticker, name, current_price }` for each peer.

### Fallback: sector_taxonomy.json

If the Finnhub call fails, the server reads `sector_taxonomy.json` from the application root. This static file maps 50+ major tickers to 8 sectors. Peers are resolved by finding all tickers in the same sector as the queried ticker.

Example sector entries:
```json
{
  "Technology": ["AAPL", "MSFT", "GOOGL", "NVDA", "META", ...],
  "Financials": ["JPM", "BAC", "WFC", "GS", "MS", ...]
}
```

The fallback returns the same response shape: `{ ticker, name, current_price }`.

### Response Shape

```typescript
interface PeerAsset {
  ticker: string;
  name: string;
  current_price: string; // NUMERIC(20,8) as string
}
```

### Price Resolution

For all peers (Finnhub or fallback), `current_price` is read from `price_cache`. If no cached price exists, `null` is returned for that asset — the UI handles this gracefully.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Finnhub called on healthy API | Mock Finnhub success → verify `/stock/peers` called |
| Static fallback on Finnhub failure | Mock Finnhub 500 → verify `sector_taxonomy.json` loaded |
| Response shape correct | Unit: assert response has `ticker`, `name`, `current_price` per item |
| `current_price` is string (not number) | Unit: `typeof response[0].current_price === "string"` |
| `null` price handled in UI | Peer with no price_cache → `PeerCard` renders price as "—" |
| 5–8 peers returned | Unit: assert 5 ≤ peers.length ≤ 8 |
