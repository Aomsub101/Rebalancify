/**
 * lib/newsService.ts
 * News fetch service for Finnhub and FMP.
 *
 * Exports pure functions for parsing and fetching news.
 * The route handlers own DB interactions; this module owns external API calls.
 *
 * Rate limits (free tiers):
 *   Finnhub: 60 calls/min — 429 means stop immediately, return rateLimited: true
 *   FMP:    250 calls/day — non-429 errors treated as failed
 *
 * Both Finnhub and FMP article shapes are normalised into NewsArticle before
 * returning. Callers upsert by externalId (ON CONFLICT DO NOTHING pattern).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NewsArticle {
  externalId: string
  source: 'finnhub' | 'fmp'
  tickers: string[]
  headline: string
  summary: string | null
  url: string
  publishedAt: Date | null
  isMacro: boolean
}

export interface FetchNewsResult {
  articles: NewsArticle[]
  rateLimited: boolean
  failed: boolean
}

// ---------------------------------------------------------------------------
// Raw shapes (internal — validated at parse time)
// ---------------------------------------------------------------------------

interface RawFinnhubArticle {
  id: number
  headline: string
  summary?: string
  url: string
  datetime?: number
  related?: string
  category?: string
}

interface RawFmpArticle {
  title: string
  text?: string
  url: string
  publishedDate?: string
  symbol?: string
}

// ---------------------------------------------------------------------------
// parseFinnhubArticle
// ---------------------------------------------------------------------------

/**
 * Parses a single raw Finnhub news article into a normalised NewsArticle.
 * Returns null if required fields are missing.
 *
 * Required: id, headline, url
 * isMacro:  true when category === 'general' or when related is blank
 */
export function parseFinnhubArticle(raw: unknown): NewsArticle | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null

  const r = raw as Record<string, unknown>

  if (typeof r.id !== 'number' && typeof r.id !== 'string') return null
  if (!r.id && r.id !== 0) return null
  if (typeof r.headline !== 'string' || !r.headline.trim()) return null
  if (typeof r.url !== 'string' || !r.url.trim()) return null

  const category = typeof r.category === 'string' ? r.category.toLowerCase() : ''
  const related = typeof r.related === 'string' ? r.related.trim() : ''

  // Tickers: related can be comma-separated ("AAPL,MSFT") or a single ticker
  const tickers: string[] = related
    ? related.split(',').map((t) => t.trim()).filter(Boolean)
    : []

  const isMacro = category === 'general' || tickers.length === 0

  const publishedAt =
    typeof r.datetime === 'number' && r.datetime > 0
      ? new Date(r.datetime * 1000)
      : null

  return {
    externalId: `finnhub-${r.id}`,
    source: 'finnhub',
    tickers,
    headline: (r.headline as string).trim(),
    summary: typeof r.summary === 'string' && r.summary.trim() ? r.summary.trim() : null,
    url: (r.url as string).trim(),
    publishedAt,
    isMacro,
  }
}

// ---------------------------------------------------------------------------
// parseFmpArticle
// ---------------------------------------------------------------------------

/**
 * Parses a single raw FMP news article into a normalised NewsArticle.
 * Returns null if required fields are missing.
 *
 * Required: title, url
 * externalId: 'fmp-<url>' — FMP does not expose a stable numeric ID on the free tier
 * isMacro:    true when symbol is absent or empty
 */
export function parseFmpArticle(raw: unknown): NewsArticle | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null

  const r = raw as Record<string, unknown>

  if (typeof r.title !== 'string' || !r.title.trim()) return null
  if (typeof r.url !== 'string' || !r.url.trim()) return null

  const symbol = typeof r.symbol === 'string' ? r.symbol.trim() : ''
  const tickers = symbol ? [symbol] : []
  const isMacro = tickers.length === 0

  let publishedAt: Date | null = null
  if (typeof r.publishedDate === 'string' && r.publishedDate.trim()) {
    const parsed = new Date(r.publishedDate.trim())
    publishedAt = isNaN(parsed.getTime()) ? null : parsed
  }

  return {
    externalId: `fmp-${(r.url as string).trim()}`,
    source: 'fmp',
    tickers,
    headline: (r.title as string).trim(),
    summary: typeof r.text === 'string' && r.text.trim() ? r.text.trim() : null,
    url: (r.url as string).trim(),
    publishedAt,
    isMacro,
  }
}

// ---------------------------------------------------------------------------
// deduplicateArticles
// ---------------------------------------------------------------------------

/**
 * Removes articles with duplicate externalId, keeping the first occurrence.
 * Runs in O(n) via a Set.
 */
export function deduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>()
  const result: NewsArticle[] = []
  for (const article of articles) {
    if (!seen.has(article.externalId)) {
      seen.add(article.externalId)
      result.push(article)
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// fetchFinnhubNews
// ---------------------------------------------------------------------------

/**
 * Fetches news from Finnhub.
 *
 * - isMacro=true  → GET /api/v1/news?category=general (no tickers filter)
 * - isMacro=false → GET /api/v1/company-news?symbol=<first ticker>&from=<30 days ago>&to=<today>
 *   For multiple tickers we make one call per ticker and merge; the free tier
 *   does not support multi-ticker batch calls. Rate limit is 60/min, so we stop
 *   immediately on any 429.
 *
 * Returns:
 *   articles:    parsed & deduplicated articles
 *   rateLimited: true if any call returned HTTP 429
 *   failed:      true if a non-429 network/server error occurred
 */
export async function fetchFinnhubNews(
  apiKey: string,
  tickers: string[],
  isMacro: boolean
): Promise<FetchNewsResult> {
  try {
    if (isMacro || tickers.length === 0) {
      // General/macro news — single call
      const url = `https://finnhub.io/api/v1/news?category=general&token=${apiKey}`
      const res = await fetch(url)
      if (res.status === 429) {
        return { articles: [], rateLimited: true, failed: false }
      }
      if (!res.ok) {
        return { articles: [], rateLimited: false, failed: true }
      }
      const data = await res.json() as unknown[]
      const articles = (Array.isArray(data) ? data : [])
        .map(parseFinnhubArticle)
        .filter((a): a is NewsArticle => a !== null)
      return { articles: deduplicateArticles(articles), rateLimited: false, failed: false }
    }

    // Per-ticker company-news calls
    const today = new Date()
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(today.getDate() - 30)
    const toStr = today.toISOString().slice(0, 10)
    const fromStr = thirtyDaysAgo.toISOString().slice(0, 10)

    const accumulated: NewsArticle[] = []
    for (const ticker of tickers) {
      const url =
        `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(ticker)}` +
        `&from=${fromStr}&to=${toStr}&token=${apiKey}`
      const res = await fetch(url)
      if (res.status === 429) {
        // Stop immediately — do not call Finnhub for remaining tickers
        return { articles: deduplicateArticles(accumulated), rateLimited: true, failed: false }
      }
      if (!res.ok) {
        // Skip this ticker, continue with others
        continue
      }
      const data = await res.json() as unknown[]
      const parsed = (Array.isArray(data) ? data : [])
        .map(parseFinnhubArticle)
        .filter((a): a is NewsArticle => a !== null)
      accumulated.push(...parsed)
    }

    return { articles: deduplicateArticles(accumulated), rateLimited: false, failed: false }
  } catch {
    return { articles: [], rateLimited: false, failed: true }
  }
}

// ---------------------------------------------------------------------------
// fetchFmpNews
// ---------------------------------------------------------------------------

/**
 * Fetches news from Financial Modeling Prep.
 *
 * For portfolio news: GET /api/v3/stock_news?tickers=AAPL,MSFT&limit=50
 * For macro/general: GET /api/v3/stock_news?limit=50 (no ticker filter)
 *
 * FMP free tier: 250 calls/day. Non-2xx responses are treated as failed.
 *
 * Returns:
 *   articles: parsed & deduplicated articles
 *   failed:   true if any HTTP or network error occurred
 *   rateLimited: always false (FMP returns 429 very rarely; treat as failed)
 */
export async function fetchFmpNews(
  apiKey: string,
  tickers: string[]
): Promise<FetchNewsResult> {
  try {
    const tickerParam = tickers.length > 0 ? `tickers=${tickers.map(encodeURIComponent).join(',')}&` : ''
    const url = `https://financialmodelingprep.com/api/v3/stock_news?${tickerParam}limit=50&apikey=${apiKey}`
    const res = await fetch(url)
    if (!res.ok) {
      return { articles: [], rateLimited: false, failed: true }
    }
    const data = await res.json() as unknown[]
    const articles = (Array.isArray(data) ? data : [])
      .map(parseFmpArticle)
      .filter((a): a is NewsArticle => a !== null)
    return { articles: deduplicateArticles(articles), rateLimited: false, failed: false }
  } catch {
    return { articles: [], rateLimited: false, failed: true }
  }
}
