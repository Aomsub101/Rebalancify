# 09 — Rate Limit Banner

## The Goal

Inform the user that the news refresh has hit Finnhub's rate limit or the 15-minute per-user rate-limit guard, so they understand why fresh articles are not available and know to wait before trying again.

---

## The Problem It Solves

When the news feed shows stale articles, users may not understand why. Without an explicit banner, they might repeatedly hit refresh and become frustrated. The banner provides honest, transparent feedback about the rate-limit condition without blocking access to the cached content.

---

## Implementation Details

**File:** `components/news/RateLimitBanner.tsx`

### Props

```typescript
interface Props {
  visible: boolean    // true to show, false to hide entirely
  onDismiss: () => void
}
```

### Appearance

- Amber/warning colour scheme (`border-warning/30 bg-warning-bg text-warning`)
- `AlertTriangle` icon (non-colour signal for accessibility)
- Dismissible via × button — state managed in `NewsPage` via `setRateLimited(false)`
- `role="alert"` for screen reader announcement

### Message

> "News refresh rate limit reached. Displaying cached articles — try again in a few minutes."

### Trigger Conditions

The `NewsPage` parent sets `visible = true` when the refresh mutation returns either:
- `rateLimited: true` (Finnhub returned 429 during the refresh batch)
- `guardHit: true` (the 15-min per-user rate-limit guard prevented the refresh)

The banner is hidden when `visible = false` (rendered as `null`).

---

## Testing & Verification

| Check | Method |
|---|---|
| Banner shown when `visible: true` | Manual: trigger rate limit → banner appears |
| Banner hidden when `visible: false` | Manual: rate limit cleared → banner disappears |
| Banner dismissable | Manual: click × → banner disappears |
| Dismissing does not clear rate limit state | Manual: dismiss → news still shows `guardHit` response's data |
| `role="alert"` for screen readers | Manual: inspect DOM → `role="alert"` present |
| Icon is non-colour signal | Visual: icon present alongside amber colour |
