# 03 — News Refresh Route

## The Goal

Fetch the latest news articles from Finnhub and FMP, deduplicate them, upsert them into `news_cache`, and return the updated article list. The route also enforces a per-user 15-minute rate-limit guard and gracefully falls back to existing cache when all external sources fail.

---

## The Problem It Solves

Without a centralised refresh endpoint, every user's browser would need to call Finnhub and FMP directly, immediately exhausting the 60-calls/min Finnhub quota. A single shared refresh that populates the global cache benefits all users and amortises the rate-limit cost.

---

## Implementation Details

**File:** `app/api/news/refresh/route.ts`

### 15-Minute Rate-Limit Guard

```typescript
// In-memory Map on globalThis — persists across requests within a server instance
const globalAny = globalThis as any
if (!globalAny.newsRateLimitMap) globalAny.newsRateLimitMap = new Map<string, number>()

const lastFetch = globalAny.newsRateLimitMap.get(user.id) || 0
if (nowMs - lastFetch < 15 * 60 * 1000) {
  // Return cached rows, no external API calls
  return NextResponse.json({ articles: cached, fromCache: true, guardHit: true })
}
globalAny.newsRateLimitMap.set(user.id, nowMs)
```

On `guardHit`, the response includes `guardHit: true` and the client shows the `RateLimitBanner`. The `newsRateLimitMap` is in-memory only — resets on server restart.

### Parallel Fetch of Three Sources

```typescript
const [finnhubPortfolio, finnhubMacro, fmpResult] = await Promise.all([
  tickers.length > 0 ? fetchFinnhubNews(finnhubKey, tickers, false) : Promise.resolve(emptyResult),
  fetchFinnhubNews(finnhubKey, [], true),
  fetchFmpNews(fmpKey, tickers),
])
```

Three fetches in parallel:
1. **Finnhub portfolio news:** per-ticker calls for the user's holdings (company news)
2. **Finnhub macro news:** general category
3. **FMP:** portfolio or general news depending on whether tickers are provided

### Upsert to news_cache

```typescript
await serviceClient.from('news_cache').upsert(rows, {
  onConflict: 'external_id',
  ignoreDuplicates: false,  // update headline/summary on re-fetch
})
```

`ON CONFLICT external_id DO UPDATE` means articles already in cache have their `headline`, `summary`, and `fetched_at` refreshed if the provider sends updated data.

### Graceful Degradation

```typescript
if (allSourcesFailed) {
  const { data: fallback } = await serviceClient.from('news_cache').select('*')
    .order('fetched_at', { ascending: false }).limit(100)
  return NextResponse.json({ articles: fallback, fromCache: true, allSourcesFailed: true })
}
```

`allSourcesFailed` is true when Finnhub (portfolio or macro) failed with non-429 AND FMP also failed. In this case, the last cached 100 articles are returned.

### Response Shape

```json
{
  "articles": [...],
  "fromCache": false,
  "rateLimited": false,
  "newArticlesCount": 47
}
```

| Flag | Meaning |
|---|---|
| `fromCache: true` | No new articles fetched — returned from DB |
| `guardHit: true` | 15-min rate-limit guard triggered |
| `rateLimited: true` | Finnhub returned 429 during this refresh |
| `allSourcesFailed: true` | Both providers failed — returning stale cache |

---

## Testing & Verification

| Check | Method |
|---|---|
| 15-min guard: second call within 15 min → `guardHit: true` | Manual: POST refresh twice in 5 min → second response has `guardHit: true` |
| 15-min guard: after 15 min → external APIs called | Manual: wait 16 min → `fromCache: false` |
| Finnhub 429 → `rateLimited: true` | Manual: exhaust Finnhub quota → refresh response `rateLimited: true` |
| All sources fail → stale cache returned | Manual: block Finnhub and FMP → `allSourcesFailed: true` |
| Upsert updates existing articles | Manual: refresh same article twice → `fetched_at` updated |
| Service-role client used for writes | Code review: `createClient` with `SUPABASE_SERVICE_ROLE_KEY` |
