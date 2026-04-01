# 08 — Article Card

## The Goal

Display a single news article with its headline, related ticker chips (up to 6), source, relative timestamp, and hover-controlled read/dismiss actions. The card links to the original article and is fully keyboard accessible.

---

## The Problem It Solves

A news feed is only useful if users can quickly scan articles and act on them. The card must surface the most relevant information (headline, tickers, age) at a glance, while keeping read/dismiss controls discoverable but not cluttering the UI when not needed.

---

## Implementation Details

**File:** `components/news/ArticleCard.tsx`

### Props

```typescript
interface Article {
  id: string
  headline: string
  tickers: string[]
  source: string
  published_at: string | null
  url: string
  is_read: boolean
  is_dismissed: boolean
}

interface Props {
  article: Article
  onMarkRead: (id: string) => void
  onDismiss: (id: string) => void
}
```

### Relative Timestamp

```typescript
function formatRelativeTime(dateStr: string | null): string {
  const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return `${Math.floor(diffHr / 24)}d ago`
}
```

### Ticker Chips

```typescript
{article.tickers.slice(0, 6).map((ticker) => (
  <span key={ticker} className="inline-block px-1.5 py-0.5 rounded bg-secondary ...">
    {ticker}
  </span>
))}
```

Maximum 6 chips shown. `font-mono uppercase` for ticker readability.

### Hover Controls

```typescript
const [hovered, setHovered] = useState(false)
// ...
{hovered && (
  <>
    <button onClick={() => onMarkRead(article.id)}>Read</button>
    <button onClick={() => onDismiss(article.id)}>Dismiss</button>
  </>
)}
```

Read and Dismiss buttons appear on `mouseEnter` and disappear on `mouseLeave`. The external link is always visible.

### Accessibility

- `aria-label` on ticker chip container
- `aria-label` on each button
- `aria-label` on external link with article headline
- `<time>` element with `dateTime` attribute

---

## Testing & Verification

| Check | Method |
|---|---|
| Hover shows read/dismiss buttons | Manual: hover over card → buttons appear |
| Hover hides buttons on mouseLeave | Manual: move mouse away → buttons disappear |
| Max 6 ticker chips shown | Manual: article with 10 tickers → only 6 shown |
| `formatRelativeTime` edge cases | Unit test: `null`, `Just now`, minutes, hours, days |
| External link opens in new tab | Manual: right-click "Read original" → "Open in new tab" |
| ARIA labels present | Manual: inspect DOM → `aria-label` attributes present |
| Read original button always visible | Manual: don't hover → "Read original" link is visible |
