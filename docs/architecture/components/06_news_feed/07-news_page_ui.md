# 07 — News Page UI

## The Goal

Provide a tabbed news interface where users can browse Portfolio News (filtered to their holdings) and Macro News (general financial news), refresh on demand, and mark articles as read or dismissed. The page is fully controlled by React state and TanStack Query.

---

## The Problem It Solves

Users need a clear, persistent way to see news relevant to their portfolio and to dismiss articles they find unhelpful. Without a well-designed news page, articles would accumulate and become stale, and users would lose track of what they have already read.

---

## Implementation Details

**File:** `app/(dashboard)/news/page.tsx` (client component)

### State Management

```typescript
const [activeTab, setActiveTab] = useState<'portfolio' | 'macro'>('portfolio')
const [portfolioPage, setPortfolioPage] = useState(1)
const [macroPage, setMacroPage] = useState(1)
const [rateLimited, setRateLimited] = useState(false)
```

Each tab maintains its own page number. Switching tabs preserves the page state of the other tab.

### Data Fetching — TanStack Query

```typescript
const { data: portfolioData, isLoading: portfolioLoading, isError: portfolioError } = useQuery({
  queryKey: ['news', 'portfolio', portfolioPage],
  queryFn: () => fetch(`/api/news/portfolio?page=${portfolioPage}&limit=20`, { headers: authHeaders }).then(r => r.json()),
  enabled: !!session,
})
```

Each tab fetches independently. The `authHeaders` come from `useSession()` (Supabase JWT).

### Refresh Mutation

```typescript
const refreshMutation = useMutation({
  mutationFn: () => fetch('/api/news/refresh', { method: 'POST', ... }).then(r => r.json()),
  onSuccess: (data) => {
    if (data.rateLimited || data.guardHit) setRateLimited(true)
    queryClient.invalidateQueries({ queryKey: ['news'] })  // invalidates both tabs
    toast.success('News refreshed')
  },
})
```

Invalidates both `['news', 'portfolio']` and `['news', 'macro']` queries on success.

### Optimistic State Updates

The `stateMutation` for read/dismiss uses TanStack Query's optimistic update pattern:
1. `cancelQueries` — cancels any in-flight refetches
2. `getQueryData` snapshots — saves both tab caches
3. `setQueryData` — immediately updates both tab caches with the new state
4. `onError` rollback — restores snapshots if the mutation fails

### Visible Articles Filter

```typescript
const visibleArticles = (activeData?.data ?? []).filter(a => !a.is_read && !a.is_dismissed)
```

Articles with either `is_read: true` or `is_dismissed: true` are excluded from the rendered list.

### Rate Limit Banner

Controlled by `rateLimited` state. Set to `true` when `refreshMutation` returns `rateLimited: true` or `guardHit: true`. Dismissed by user clicking the × button.

### Pagination Controls

Previous/Next buttons appear when `total > 20`. Previous is disabled on page 1. Next is disabled when `!hasMore`.

---

## Testing & Verification

| Check | Method |
|---|---|
| Tab switch preserves page state | Manual: go to page 2 of portfolio → switch to macro → switch back → page 2 preserved |
| Refresh invalidates both tabs | Manual: refresh → both portfolio and macro queries refetch |
| Dismiss removes article from visible list | Manual: dismiss article → it disappears immediately (optimistic) |
| Dismiss rollback on error | Manual: simulate 500 from state route → article reappears |
| RateLimitBanner shown on `guardHit` | Manual: call refresh twice within 15 min → banner appears |
| Pagination works | Manual: click Next → page 2 → correct offset in network request |
| Disclaimer shown | Manual: news page visible → "This is not financial advice" text present |
