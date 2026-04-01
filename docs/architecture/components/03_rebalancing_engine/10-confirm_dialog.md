# Sub-Component: ConfirmDialog

## 1. The Goal

Provide a confirmation dialog for destructive or financially significant actions (order execution, silo deletion, account deletion) that can only be closed by explicit user action — not by clicking outside or pressing Escape.

---

## 2. The Problem It Solves

Without a non-dismissible dialog, a user could accidentally trigger an order execution by clicking the backdrop, or the dialog could auto-close when pressing Escape while typing in another field. Financial actions require deliberate, intentional confirmation.

---

## 3. The Proposed Solution / Underlying Concept

### From `components/shared/ConfirmDialog.tsx`

Uses the `Dialog` component from `shadcn/ui`.

```typescript
<Dialog open={open}>
  <DialogContent
    onEscapeKeyDown={(e) => e.preventDefault()}      // Rule 10
    onInteractOutside={(e) => e.preventDefault()}     // Rule 10
  >
```

- **`onEscapeKeyDown`**: calling `e.preventDefault()` stops the dialog from closing on Escape
- **`onInteractOutside`**: calling `e.preventDefault()` stops the dialog from closing on backdrop click

**No `onOpenChange` prop is passed** — the dialog is fully controlled by the parent component's `open` state.

### Variant Support

```typescript
variant?: 'default' | 'destructive'

// default: primary button (blue)
// destructive: negative/red button (for silo delete, account delete)
```

### Layout

```
┌─────────────────────────────────┐
│  DialogTitle (title)             │
│  DialogDescription (optional)     │
│  ─────────────────────────────  │
│  {children} (content)           │
│  ─────────────────────────────  │
│  [Cancel (ghost, left)] [OK (primary or destructive, right)] │
└─────────────────────────────────┘
```

### Usage in OrderReviewPanel

```typescript
<ConfirmDialog
  open={confirmOpen}
  title={`Execute ${approvedOrderIds.length} order(s) on ${platformLabel}?`}
  confirmLabel={isAlpaca ? 'Confirm & submit to Alpaca' : 'Confirm — I will execute manually'}
  cancelLabel="Cancel"
  onConfirm={() => executeOrders()}
  onCancel={() => setConfirmOpen(false)}
  isLoading={isExecuting}
>
  <div>Order count, platform, total value</div>
</ConfirmDialog>
```

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Clicking backdrop does not close | Click dialog backdrop → dialog stays open |
| Escape key does not close | Press Escape → dialog stays open |
| Only Cancel closes | Click Cancel → dialog closes |
| Only Confirm closes | Click Confirm → dialog closes |
| Loading state on Confirm | `isLoading=true` → Confirm button shows "Processing…" |
| Destructive variant is red | Pass `variant="destructive"` → red confirm button |
| `pnpm build` | Compiles without errors |
