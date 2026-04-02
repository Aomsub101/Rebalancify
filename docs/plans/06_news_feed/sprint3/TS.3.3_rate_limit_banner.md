# TS.3.3 — Rate Limit Banner

## Task
Build RateLimitBanner shown when Finnhub is rate-limited or 15-min refresh guard hit.

## Target
`components/news/RateLimitBanner.tsx`

## Inputs
- `docs/architecture/components/06_news_feed/09-rate_limit_banner.md`

## Process
1. Create `components/news/RateLimitBanner.tsx`:
   - Props: `{ isRateLimited: boolean, retryAfterSeconds?: number }`
   - Amber banner, collapsible (user can dismiss temporarily)
   - Text: "News refresh is temporarily limited. Try again in X minutes."
   - Countdown timer showing when refresh becomes available
   - Shown when: POST /api/news/refresh returns `rate_limited: true`
2. Banner reappears on next rate-limited refresh attempt
3. Does not block reading existing cached articles

## Outputs
- `components/news/RateLimitBanner.tsx`

## Verify
- Appears when rate limited
- Countdown timer accurate
- Collapsible
- Does not block article reading

## Handoff
→ Sprint 4 (Testing)
