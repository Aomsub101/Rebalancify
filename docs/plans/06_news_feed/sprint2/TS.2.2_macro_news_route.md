# TS.2.2 — Macro News Route

## Task
Implement GET /api/news/macro returning all macro financial news articles.

## Target
`app/api/news/macro/route.ts`

## Inputs
- `docs/architecture/components/06_news_feed/05-macro_news_route.md`

## Process
1. Create `app/api/news/macro/route.ts`:
   - Query `news_cache WHERE is_macro = TRUE`, ordered by `published_at DESC`
   - Filter out user's dismissed articles via LEFT JOIN with user_article_state
   - Paginate: `?page=1&limit=20`
   - Return same shape as portfolio news
2. Macro news is not filtered by user's tickers — it's general market news

## Outputs
- `app/api/news/macro/route.ts`

## Verify
- Only `is_macro = TRUE` articles returned
- Dismissed articles filtered
- Pagination works

## Handoff
→ TS.2.3 (News refresh route)
