# docs/design/04-ux-patterns.md — UX Patterns

## AGENT CONTEXT

**What this file is:** Interaction patterns, accessibility rules, and the animation specification.
**Derived from:** design_preferences.md Sections 6, 7, 8, 9
**Connected to:** docs/design/02-component-library.md (component implementations), docs/design/CLAUDE_FRONTEND.md, docs/design/05-theme-implementation.md (source of truth for token values used in colour-state classNames)
**Critical rules for agents using this file:**
- Every interactive element must have a visible focus ring. `outline-none` without `focus-visible:ring` is a bug.
- Reduced motion must be handled — use `useReducedMotion()` and set duration to 0ms when true.
- The onboarding modal is shown exactly once (first login). Never shown again after dismissal.

---

## Onboarding Flow

### Quick-Start Modal (First Login Only)

Shown exactly once after email verification. Stored as `onboarded: true` in `user_profiles` after dismissal.

**On platform selection:** Modal closes → `POST /api/silos` pre-creates silo with correct `platform_type` and `base_currency` → user lands on that silo's detail page → progress banner appears at top.

**On "Skip for now":** Modal closes → user lands on Overview with full empty state → no progress banner.

### Progress Banner (Post-Onboarding)

Appears when user has completed platform selection but has zero holdings. Dismissible with X button. Dismissal is stored in `user_profiles.onboarded = TRUE` via `PATCH /api/profile` — NOT in localStorage. This ensures the banner does not reappear when the user switches devices.

```
● Add holdings  →  ○ Set target weights  →  ○ Run first rebalance  [✕]
```

---

## State Patterns

### Optimistic Updates and Failure Rollback

When using optimistic updates (UI updates before server confirmation), the failure
path MUST be specified:

1. **On success:** Keep the optimistically updated value. Fire `toast.success(...)`.
2. **On failure:** Rollback to the previous value using TanStack Query's `onError` with the `context` from `onMutate`. Fire `toast.error(...)` explaining what failed.

```tsx
const mutation = useMutation({
  mutationFn: updateWeight,
  onMutate: async (newWeight) => {
    await queryClient.cancelQueries({ queryKey: ['holdings', siloId] })
    const previous = queryClient.getQueryData(['holdings', siloId])
    queryClient.setQueryData(['holdings', siloId], (old) => /* optimistic update */)
    return { previous } // context passed to onError
  },
  onError: (error, variables, context) => {
    queryClient.setQueryData(['holdings', siloId], context?.previous) // rollback
    toast.error('Save failed — your change has been reverted')
  },
  onSuccess: () => {
    toast.success('Saved')
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['holdings', siloId] })
  },
})
```

This pattern MUST be used for: holdings quantity inline edit, target weight
inline edit, article read/dismiss state.

---

### Loading States

Every data-fetching component must show a `LoadingSkeleton` while the query is pending. Skeletons must match the shape of the content they replace — not generic grey boxes. Never show a blank screen.

### Empty States

Every list or table must have a defined empty state with:
1. A minimal Lucide icon (not an illustration)
2. One clear description line
3. Exactly one CTA button that resolves the emptiness

### Unsaved Changes State

Components where the user edits data that requires an explicit Save action MUST
guard against accidental navigation away.

**When to apply:** target weight editor, display name editor in Settings, any
inline editor where the user must click a Save/Submit button to persist.

**Implementation:**
1. Track `isDirty: boolean` — becomes `true` on first change, `false` on successful save.
2. Use `useDirtyGuard(isDirty)` hook which registers a `beforeunload` listener.
3. Show a visual dirty indicator (amber dot or border) on the component while `isDirty` is true, so users know they have unsaved changes before navigating.
4. On successful save, fire `toast.success('Saved')` AND reset `isDirty` to `false`.

**Do NOT** disable the Save button while in a clean state. Keep the button always
enabled — clicking Save when nothing changed is harmless and prevents confusion.

---

### Error States

Every API-dependent component must show `ErrorBanner` when the query fails. The banner:
- Appears at the top of the affected section (not as a modal)
- Shows the error code and a human-readable message
- Has a Retry button
- Does not block unaffected sections of the page

### Offline State

`OfflineBanner` in `AppShell` detects `navigator.onLine = false` and shows a persistent banner. Features unavailable offline display a soft "unavailable offline" indicator — not an error.

---

## Toast Feedback — Mutation Results

Every write operation (create, update, delete, sync, save) MUST show a Sonner toast
confirming the outcome. Silence after a user action is a UX failure.

**Use `sonner`'s `toast()` function. Never use the shadcn/ui Toast component.**

### Required Toast Calls by Action Type

| User Action | Success Toast | Failure Toast |
|---|---|---|
| Create silo | `toast.success('Silo created')` | `toast.error('Failed to create silo')` |
| Delete silo | `toast.success('Silo deleted', { description: 'Your data is preserved and can be recovered.' })` | `toast.error('Failed to delete silo')` |
| Save display name | `toast.success('Display name saved')` | `toast.error('Save failed — try again')` |
| Save notification preference | `toast.success('Notification preference saved')` | `toast.error('Save failed')` |
| Save API key (Alpaca, BITKUB, etc.) | `toast.success('API key saved', { description: 'Connection established.' })` | `toast.error('Key save failed — check your key and try again')` |
| Sync silo holdings | `toast.success('Sync complete', { description: '${count} holdings updated' })` | `toast.error('Sync failed', { description: error.message })` |
| Add asset to silo | `toast.success('Asset added')` | `toast.error('Failed to add asset')` |
| Save target weights | `toast.success('Weights saved')` | `toast.error('Save failed — weights unchanged')` |
| Copy manual order instructions | `toast.success('Copied to clipboard')` | — |
| Mark article read | No toast (silent optimistic — too frequent for toasts) | `toast.error('Could not update — refresh to retry')` |
| Dismiss article | No toast (silent optimistic) | `toast.error('Could not dismiss — refresh to retry')` |

### Implementation Pattern

Use the `useMutation` `onSuccess` and `onError` callbacks:

```tsx
const mutation = useMutation({
  mutationFn: (payload) => fetch('/api/silos', { method: 'POST', body: JSON.stringify(payload) }).then(r => r.json()),
  onSuccess: () => {
    toast.success('Silo created')
    queryClient.invalidateQueries({ queryKey: ['silos'] })
    queryClient.invalidateQueries({ queryKey: ['profile'] })
  },
  onError: (error) => {
    toast.error('Failed to create silo', { description: error.message })
  },
})
```

### Toast Rules

- **Duration:** 4 seconds for success. 6 seconds for error (user needs time to read).
- **Position:** Always `bottom-right` (set globally in `<Toaster>` in `app/layout.tsx`).
- **One toast per action.** Never stack multiple toasts for a single user action.
- **No toast for read operations** (`GET` requests). Toasts are only for writes.
- **No toast for optimistic updates that have no visible failure path** (e.g., marking articles read).
- **Financial data mutations always get a toast** — no exceptions. Users must know their weight save landed.

---

## Copy-to-Clipboard Pattern

Used wherever users need to take data to another platform. Always confirm with a toast.

```tsx
async function copyToClipboard(text: string, label = 'Copied') {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(label)
  } catch {
    toast.error('Copy failed — please select and copy manually')
  }
}
```

**Where copy must be implemented:**

| Location | What is copied | Toast message |
|---|---|---|
| Step 3 wizard — each `ManualOrderRow` | Single instruction text | `'Copied'` |
| Step 3 wizard — `CopyAllButton` | All instructions as numbered list | `'Instructions copied to clipboard'` |

**Copy button implementation:**

```tsx
<button
  onClick={() => copyToClipboard(text)}
  aria-label="Copy to clipboard"
  className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors
             focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
>
  <Copy className="w-4 h-4" />
</button>
```

Do NOT use a toggle (Copy → Copied icon swap). Use the toast instead. The icon
swap pattern is redundant when a toast confirms the action.

---

## Accessibility Requirements

1. **Keyboard navigation:** All interactive elements reachable via Tab. Logical focus order (left-to-right, top-to-bottom).
2. **Focus ring:** Always visible. `focus-visible:ring-2 focus-visible:ring-ring` on all interactive elements. Never `outline-none` alone.
3. **Colour contrast:** Minimum 4.5:1 for body text, 3:1 for large text and UI components. Verified in both modes.
4. **Colour independence:** Drift badges always include an icon. Status chips always include a text label. Charts always include a text legend.
5. **ARIA labels:** All icon-only buttons must have `aria-label`. All loading states must have `aria-busy="true"` or `role="status"`.
6. **Reduced motion:** All animations in `@media (prefers-reduced-motion: reduce)` set duration to 0ms. Use `useReducedMotion()` hook.
7. **Screen reader text:** `฿1,247,500.00` should have `aria-label="1,247,500 Thai Baht"`.

---

## Animation Rules

### Approved Animations

| Animation | Implementation | When Used |
|---|---|---|
| Page transition | `animate-in fade-in duration-150` | Every route change |
| Skeleton → content | Pulse → instant swap | All data-loading states |
| Dialog in | `animate-in zoom-in-95 duration-200` | All ConfirmDialogs |
| Nav hover | `transition-colors duration-150` | Nav item hover |
| Card hover | `transition-colors duration-150` | Hoverable cards |
| Toast | `animate-in slide-in-from-right duration-300` | All toasts |
| Drift badge change | `transition-colors duration-300` | Crossing threshold |

### Prohibited Animations

| Animation | Reason |
|---|---|
| Number count-up on data load | Irritating on repeat visits |
| Parallax scrolling | Motion sickness; incompatible with data-dense layouts |
| Auto-playing looping animations | Distracting |
| Bounce / spring physics | Wrong brand tone |
| Fade-in of individual table rows | Jank at 20-50 rows |

**Motion principle:** Only animate things that help the user understand what changed. Animations that exist purely for delight are inappropriate.

---

## Security-Visible UI Patterns

1. **API key inputs:** `type="password"` with show/hide toggle. Never auto-fill. Shows `••••••••` after saving.
2. **Order execution confirmation:** `ConfirmDialog` shows exact order count, platform name, total estimated value. Non-dismissible (no `onOpenChange`).
3. **Alpaca live mode indicator:** Persistent amber `LIVE` badge on silo card and at top of rebalancing wizard. Cannot be hidden.
4. **Manual order instructions:** Step 3 shows per-order plain-language instructions: "Buy X shares of AAPL on [Platform Name]."
5. **Regulatory disclaimer:** "This is not financial advice." in footer of every page. Always visible.
6. **Price freshness indicator in rebalancing wizard:** Step 1 of the rebalancing wizard must show the age of the most recently fetched price for the silo's holdings. Display as: "Prices last updated [X min/hr] ago". If any price is older than 10 minutes: show in `text-warning` with a "Refresh prices" link. The user must know how fresh their data is before they approve financial orders.
