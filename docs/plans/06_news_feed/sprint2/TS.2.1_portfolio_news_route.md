# TS.2.1 — Portfolio News Route

## Task
Implement GET /api/news/portfolio with two-tier ticker matching and pagination.

## Target
`app/api/news/portfolio/route.ts`

## Inputs
- Sprint 1 outputs (newsQueryService, news_cache)
- `docs/architecture/components/06_news_feed/04-portfolio_news_route.md`

## Process
1. Create `app/api/news/portfolio/route.ts`:
   - Validate JWT
   - Fetch user's holding tickers from all active silos
   - Call `newsQueryService.splitIntoTiers(articles, userTickers)`
   - Merge and rank: tier-1 articles first
   - Filter out articles where user has `is_dismissed = true`
   - Paginate: `?page=1&limit=20`
   - Return: `{ articles: [...], total, page, limit, has_more }`
2. Each article includes: id, headline, summary, url, tickers, source, published_at, is_read

## Outputs
- `app/api/news/portfolio/route.ts`

## Verify
- Tier 1 articles appear before Tier 2
- Dismissed articles filtered out
- Pagination correct
- No articles for user with zero holdings → empty

## Handoff
→ TS.2.2 (Macro news route)
