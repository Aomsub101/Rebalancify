# TS.3.2 — Article Card

## Task
Build the ArticleCard component with headline, ticker tags, and read/dismiss controls.

## Target
`components/news/ArticleCard.tsx`

## Inputs
- `docs/architecture/components/06_news_feed/08-article_card.md`

## Process
1. Create `components/news/ArticleCard.tsx`:
   - **HeadlineText:** Article headline (clickable → external URL)
   - **TickerTags:** Small chips per ticker in `article.tickers` array
   - **SourceAndTimestamp:** "Finnhub · 2 hours ago"
   - **ExternalLink:** Opens original article URL in new tab
   - **ReadDismissControls:** Appear on hover
     - "Mark as read" → PATCH /api/news/articles/:id/state `{ is_read: true }`
     - "Dismiss" → PATCH `{ is_dismissed: true }` → card fades out
2. Read articles: slightly muted styling (lower opacity)
3. Dismissed articles: removed from list (optimistic)

## Outputs
- `components/news/ArticleCard.tsx`

## Verify
- All article fields display correctly
- Hover reveals read/dismiss controls
- Optimistic dismiss: card fades immediately
- External link opens in new tab

## Handoff
→ TS.3.3 (RateLimitBanner)
