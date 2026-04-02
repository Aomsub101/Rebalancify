# TS.3.3 — Quota & Rate Limit Handling

## Task
Implement graceful handling for ExchangeRate-API quota exhaustion and Finnhub rate limits.

## Target
`lib/fxRates.ts`, `lib/priceService.ts`

## Inputs
- `docs/architecture/01-tech-stack-decisions.md` (ADR-014)

## Process
1. **ExchangeRate-API quota exhaustion:**
   - HTTP 429 from ExchangeRate-API → log `EXCHANGERATE_QUOTA_EXHAUSTED`
   - Distinguish from transient outage (different log level)
   - Return stale cached rates (same behavior as outage)
   - UI: disable USD toggle, show "FX data unavailable" tooltip
   - Recovery: automatic on 1st of following month
2. **Finnhub rate limits:**
   - HTTP 429 → return stale price_cache entry if available
   - Log rate limit hit with ticker context
   - Implement exponential backoff for bulk price fetches
3. **CoinGecko rate limits:**
   - Free tier: 10-50 calls/minute
   - Return stale cache on 429
4. All quota/rate-limit events logged with structured format for monitoring

## Outputs
- Updated `lib/fxRates.ts` (quota detection)
- Updated `lib/priceService.ts` (rate limit handling)
- `lib/rateLimitHandler.ts` (shared backoff utility)

## Verify
- Quota exhaustion → stale data returned, no error to user
- Rate limit → graceful degradation with stale data
- Logs distinguish quota vs transient failure

## Handoff
→ Component 05 complete
