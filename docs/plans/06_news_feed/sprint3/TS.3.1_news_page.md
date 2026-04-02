# TS.3.1 — News Page

## Task
Build the News page with Portfolio/Macro tabs, RefreshBar, and pagination.

## Target
`app/(dashboard)/news/page.tsx`

## Inputs
- Sprint 2 outputs (all news API routes)
- `docs/architecture/components/06_news_feed/07-news_page_ui.md`
- `docs/architecture/04-component-tree.md` §2.7

## Process
1. Create `app/(dashboard)/news/page.tsx`:
   - **NewsTabs:** Two tabs — "Portfolio News" (default) and "Macro News"
   - **RefreshBar:** "Last updated [relative time]" + Refresh button → POST /api/news/refresh
   - **RateLimitBanner:** Conditional amber banner when rate limited
   - **ArticleList:** Renders ArticleCard per article (filters out dismissed)
   - **PaginationControls:** Previous / Next (shown when `total > 20`)
   - **EmptyState:** "No articles matching your portfolio" when empty
   - **LoadingSkeleton:** During initial fetch
2. Tab switch fetches from portfolio or macro endpoint
3. Optimistic updates: read/dismiss → UI updates immediately, rollback on error
4. TanStack Query keys: `['news', 'portfolio', page]`, `['news', 'macro', page]`

## Outputs
- `app/(dashboard)/news/page.tsx`
- `components/news/NewsTabs.tsx`
- `components/news/RefreshBar.tsx`

## Verify
- Both tabs load correct data
- Refresh button fetches new articles
- Pagination navigates correctly
- Dismissed articles disappear from list

## Handoff
→ TS.3.2 (ArticleCard)
