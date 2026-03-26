# docs/design/CLAUDE_FRONTEND.md — Frontend Instructions for Claude Code

## AGENT CONTEXT

**What this file is:** A comprehensive, self-contained frontend instruction file. A Claude Code agent implementing any UI component must read this file first. It consolidates design tokens, component patterns, formatting rules, and anti-patterns so the agent does not need to open multiple design files.
**Derived from:** design_preferences.md (all sections), docs/design/01-design-system.md, docs/design/02-component-library.md
**Connected to:** docs/architecture/04-component-tree.md, CLAUDE.md (Rules 1–7, 11–17, 20)
**Critical rules for agents using this file:**
- Read every section before writing any UI code.
- If in doubt about a design decision not covered here, derive it from the principles in Section 1 — never from personal preference.

---

## 1. Never-Violate Rules (Frontend Absolute)

1. **No `<form>` tags.** Use `onClick` on buttons + controlled state. No `onSubmit` handlers.
2. **Tailwind classes only.** No `style={{}}`. No CSS Modules. No styled-components.
3. **One primary button per page section.** Two primary buttons on screen simultaneously is always a bug.
4. **All numeric display goes through `formatNumber()`.** Never format numbers inline.
5. **All external API calls go through `/api/` routes.** Never call Finnhub, Alpaca, etc. from client components.
6. **ConfirmDialog is non-dismissible.** No `onOpenChange`. Only Cancel and Confirm buttons close it.
7. **Focus rings on everything interactive.** `focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`.
8. **Every data-fetching component has:** LoadingSkeleton (pending state), EmptyState (no data), ErrorBanner (error state).
9. **The sidebar is always `bg-sidebar`** — never changes with theme. (`bg-sidebar` = `hsl(var(--sidebar-background))` via tailwind.config.ts)
10. **Numeric table cells:** always `text-right font-mono tabular-nums`.
11. **Drift badges:** always include an icon (Circle / Triangle / AlertCircle) in addition to colour.
12. **`rounded-md` for buttons. `rounded-lg` for cards.** Never `rounded-full` for interactive elements.
13. **The LIVE badge must appear on Alpaca live-mode silos** — on the silo card and at the top of the rebalancing wizard. It cannot be hidden.
14. **Regulatory disclaimer in footer of every page:** "This is not financial advice."
15. **API key inputs: `type="password"` with show/hide toggle.** Never show the key value after saving.

---

## 2. Design System Quick Reference

### Colour Tokens (Tailwind class → CSS variable)

| Context | Tailwind Class | Light Hex | Dark Hex |
|---|---|---|---|
| Page background | `bg-background` | `#F8F9FA` | `#0F1117` |
| Card surface | `bg-card` | `#FFFFFF` | `#1A1F2E` |
| Primary text | `text-foreground` | `#111827` | `#E2E8F0` |
| Secondary text / labels | `text-muted-foreground` | `#64748B` | `#94A3B8` |
| Primary / Action Blue | `bg-primary text-primary-foreground` | `#2E75B6` | `#2E75B6` |
| Action button | `bg-primary text-primary-foreground` | `#2E75B6` | `#2E75B6` |
| Secondary surface | `bg-secondary` | `#EEF2F7` | `#1E293B` |
| Borders | `border-border` | `#D1D9E6` | `#1E293B` |
| Focus ring | `ring-ring` | `#2E75B6` | `#2E75B6` |
| Gain / success | `text-positive bg-positive-bg` | `#1A6B3C` / `#D6F0E0` | `#22C55E` / `#14532D` |
| Warning / approaching | `text-warning bg-warning-bg` | `#CC7000` / `#FFF0D6` | `#F59E0B` / `#451A03` |
| Loss / error / breach | `text-negative bg-negative-bg` | `#A00000` / `#FAD7D7` | `#EF4444` / `#450A0A` |
| Sidebar | `bg-sidebar` | `#1E3A5F` | `#111827` |
| Secondary surface text | `text-secondary-foreground` | `#1E3A5F` | `#E2E8F0` |
| Sidebar text | `text-[var(--sidebar-foreground)]` | `#E2E8F0` | `#E2E8F0` |

> **Token convention:** `--primary` = Action Blue (#2E75B6) — the main interactive colour. This follows shadcn/ui convention where the `default` button variant uses `bg-primary`. `--accent` = ghost/outline hover surface (a subtle grey). Never use `bg-accent` for primary call-to-action buttons.

### Typography

| Use | Tailwind Classes |
|---|---|
| Page heading | `text-3xl font-semibold` |
| Section heading | `text-2xl font-semibold` |
| Card title | `text-xl font-medium` |
| Body copy | `text-base font-normal` |
| Table text | `text-sm font-normal` |
| Metadata | `text-xs text-muted-foreground` |
| Hero stat number | `text-2xl font-mono font-semibold` |
| Table numeric | `text-base font-mono font-medium tabular-nums` |
| Status chip | `text-[10px] font-mono uppercase tracking-wide` |

### Layout

- Page container: `max-w-7xl mx-auto px-6`
- Silo cards: `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6`
- Peer cards: `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4`
- News articles: `max-w-3xl`
- Settings form: `max-w-2xl`
- Confirmation modal: `max-w-md`
- Complex modal: `max-w-2xl`

---

## 3. Component Quick Reference

```tsx
// Standard card
"bg-card border border-border rounded-lg p-4"

// Hoverable card (SiloCard, PeerCard)
"bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors cursor-pointer"

// Primary button
"bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium
 hover:bg-primary/90 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"

// Secondary button
"border border-border bg-transparent px-4 py-2 rounded-md text-sm font-medium
 hover:bg-secondary transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"

// Ghost button
"px-4 py-2 rounded-md text-sm font-medium hover:bg-secondary transition-colors
 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"

// Destructive button
"bg-negative text-white px-4 py-2 rounded-md text-sm font-medium
 hover:bg-negative/90 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"

// Table container
"w-full border border-border rounded-lg overflow-hidden"

// Table header
"bg-secondary text-muted-foreground text-xs font-mono uppercase tracking-wider"

// Table header cell
"px-4 py-3 text-left"

// Table data row (alternating)
"border-t border-border hover:bg-secondary/50 transition-colors"

// Numeric cell (ALWAYS)
"px-4 py-3 text-right font-mono text-sm tabular-nums"

// Text cell
"px-4 py-3 text-sm"

// Green DriftBadge
"inline-flex items-center gap-1 px-2 py-0.5 rounded bg-positive-bg text-positive text-xs font-mono"

// Amber DriftBadge
"inline-flex items-center gap-1 px-2 py-0.5 rounded bg-warning-bg text-warning text-xs font-mono"

// Red DriftBadge
"inline-flex items-center gap-1 px-2 py-0.5 rounded bg-negative-bg text-negative text-xs font-mono"
```

---

## 4. Financial Data Formatting Rules

All implemented in `lib/formatNumber.ts`. Never format inline.

**TypeScript function signature:**
```typescript
function formatNumber(
  value: string | number,
  type: 'price' | 'weight' | 'drift' | 'quantity' | 'staleness',
  context?: 'USD' | 'THB' | 'stock' | 'crypto'
): string

// Rules:
// - 'price' requires context ('USD' or 'THB')
// - 'quantity' requires context ('stock' or 'crypto')
// - 'weight' and 'drift' use no context (percentage always)
// - 'staleness' takes the age in days as value (number), context unused — pass stale_days from the API response directly
// - Returns a formatted string, never a number
```

```typescript
// Usage:
formatNumber(value, 'price', 'USD')      // → "$185.20"
formatNumber(value, 'price', 'THB')      // → "฿1,547,000.00"
formatNumber(value, 'weight')            // → "14.82%"
formatNumber(value, 'drift')             // → "+2.18%" or "-1.44%"
formatNumber(value, 'quantity', 'stock') // → "10" or "10.5"
formatNumber(value, 'quantity', 'crypto')// → "0.00245000"
formatNumber(staleDays, 'staleness')     // → "1 day ago" or "14 days ago" — staleDays is from API field stale_days (integer, days)
```

| Data Type | Rule | Example |
|---|---|---|
| Portfolio value (THB) | 2dp + thousands separator | `฿1,247,500.00` |
| Portfolio value (USD) | 2dp + thousands separator | `$12,475.00` |
| Weight percentage | 2dp, no thousands | `14.82%` |
| Drift percentage | 2dp + always show sign | `+2.18%` or `-1.44%` |
| Quantity — stocks | 0dp for integers, max 4dp fractional | `10` or `10.5000` |
| Quantity — crypto | 8dp always | `0.00245000` |
| Price — stocks | 2dp | `$185.20` |
| Price — crypto | 2dp | `฿1,547,000.00` |
| Staleness | Relative time | `14 min ago` / `3 days ago` |

**Screen reader text:** Always add `aria-label` with unambiguous pronunciation: `aria-label="1,247,500 Thai Baht"`.

---

## 5. State Management Patterns

| State Type | Tool | When |
|---|---|---|
| Server state (API data) | `useQuery` / `useMutation` from TanStack Query | ALL API-fetched data |
| Global UI state | `useContext(SessionContext)` | User profile, USD toggle, silo count |
| Local UI state | `useState` / `useReducer` | Form inputs, modal open/close, wizard step |

**Rules:**
- Never use `useEffect` for data fetching. Always use `useQuery`.
- Never store API responses in `useState`. Let React Query cache them.
- `useMutation` must call `queryClient.invalidateQueries()` after success — see invalidation rules in `docs/architecture/04-component-tree.md`.
- `SessionContext` provides: `session`, `profile`, `showUSD`, `siloCount`. Read these, do not re-fetch the profile in every component.

---

## 6. API Call Patterns

### From Server Components (RSC)

```typescript
// app/(dashboard)/silos/page.tsx
import { createServerClient } from '@/lib/supabase/server'

export default async function SilosPage() {
  const supabase = createServerClient()
  const { data: silos } = await supabase
    .from('silos')
    .select('*')
    .eq('is_active', true)
    .order('created_at')
  // ...
}
```

### From Client Components

```typescript
// app/(dashboard)/silos/[silo_id]/page.tsx (client component)
import { useQuery } from '@tanstack/react-query'

function SiloDetailPage({ siloId }: { siloId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['holdings', siloId],
    queryFn: () => fetch(`/api/silos/${siloId}/holdings`).then(r => r.json()),
  })

  if (isLoading) return <LoadingSkeleton />
  if (error) return <ErrorBanner error={error} onRetry={refetch} />
  if (!data?.holdings?.length) return <EmptyState />
  // ...
}
```

### Mutations

```typescript
const mutation = useMutation({
  mutationFn: (payload) =>
    fetch('/api/silos', { method: 'POST', body: JSON.stringify(payload) }).then(r => r.json()),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['silos'] })
    queryClient.invalidateQueries({ queryKey: ['profile'] })
  },
})
```

---

## 7. Accessibility Checklist

Before marking any component complete, verify:

- [ ] All buttons have visible text OR `aria-label` (icon-only buttons)
- [ ] All inputs have associated `<label>` elements
- [ ] Focus order follows visual reading order (Tab through the page)
- [ ] `focus-visible:ring-2 focus-visible:ring-ring` on ALL interactive elements
- [ ] Loading states: `aria-busy="true"` on the loading container
- [ ] Colour signals have secondary signal (icon or text): DriftBadge icon ✓, status chip text ✓
- [ ] Numeric formatted values have `aria-label` with unambiguous pronunciation
- [ ] Reduced motion respected: `useReducedMotion()` → set duration to 0ms

---

## 8. Common Mistakes to Avoid

| Mistake | Correct Pattern |
|---|---|
| `<form onSubmit={...}>` | Remove the form tag; use `onClick` on the submit button |
| `style={{ color: '#A00000' }}` | `className="text-negative"` |
| `${price.toFixed(2)}` | `formatNumber(price, 'price', currency)` |
| `fetch('https://finnhub.io/api/...')` in a component | `fetch('/api/prices/...')` |
| `useEffect(() => { fetch(...) }, [])` | `useQuery({ queryKey: [...], queryFn: ... })` |
| `<button className="rounded-full ...">` | `<button className="rounded-md ...">` |
| Two `bg-primary` buttons in the same section | One primary, one ghost or secondary |
| `outline-none` on a button | `outline-none focus-visible:ring-2 focus-visible:ring-ring` |
| `Math.floor(drift)` for display | `drift.toFixed(2)` inside `formatNumber()` |
| `<Dialog onOpenChange={setOpen}>` for ConfirmDialog | No `onOpenChange` — non-dismissible |
| Text-only drift badge (no icon) | `<Circle />`, `<Triangle />`, or `<AlertCircle />` + text |
| `parseInt()` or `parseFloat()` for monetary arithmetic | Use string comparison; never float arithmetic on money |
| `localStorage` for read/dismiss article state | `user_article_state` table via `PATCH /api/news/articles/:id/state` |
| No toast after a mutation | Add `toast.success(...)` in `onSuccess` and `toast.error(...)` in `onError` — see `docs/design/04-ux-patterns.md` Toast Feedback section |
| Using shadcn/ui Toast component | Use `sonner` only — call `toast.success()`, `toast.error()`, `toast.info()` directly |
