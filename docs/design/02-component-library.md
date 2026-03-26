# docs/design/02-component-library.md — Component Library

## AGENT CONTEXT

**What this file is:** The Tailwind className strings and usage rules for every reusable UI component. Copy these exact strings into implementations.
**Derived from:** design_preferences.md Section 5
**Connected to:** docs/design/01-design-system.md (token values and hex references), docs/architecture/04-component-tree.md (which components exist), docs/design/05-theme-implementation.md (source of truth for Tailwind utility class definitions — `bg-sidebar`, `bg-positive`, `bg-negative`, `bg-warning` are defined there)
**Critical rules for agents using this file:**
- `rounded-lg` for cards. `rounded-md` for buttons. Never `rounded-full` for interactive elements.
- Maximum one primary button per page section. Two primary buttons on the same screen is always a design error.
- Tables on mobile: horizontally scrollable with sticky first column. Never collapse to card layout.
- Numeric cells: always `text-right font-mono tabular-nums`.

---

## Cards

```tsx
/* Standard card */
className="bg-card border border-border rounded-lg p-4"

/* Hoverable card (SiloCard, PeerCard) */
className="bg-card border border-border rounded-lg p-4
           hover:border-primary/50 transition-colors cursor-pointer"

/* Alert card (drift threshold breached) */
className="bg-negative-bg border border-negative/30 rounded-lg p-4"

/* Warning card (approaching threshold) */
className="bg-warning-bg border border-warning/30 rounded-lg p-4"
```

**Card rules:**
- Border radius: `rounded-lg` (8px). Not `rounded-2xl`, not sharp corners.
- No drop shadows by default. Shadows only on modals and popovers.
- `hover:border-primary/50` — the border highlights to Action Blue on hover.

---

## Buttons

```tsx
/* Primary — Action Blue. One per page section maximum. */
className="bg-primary text-primary-foreground px-4 py-2 rounded-md
           text-sm font-medium hover:bg-primary/90 transition-colors
           focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"

/* Secondary — outlined */
className="border border-border bg-transparent px-4 py-2 rounded-md
           text-sm font-medium hover:bg-secondary transition-colors
           focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"

/* Destructive — irreversible actions (delete silo, delete account) */
className="bg-negative text-white px-4 py-2 rounded-md
           text-sm font-medium hover:bg-negative/90 transition-colors
           focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"

/* Ghost — low-emphasis actions */
className="px-4 py-2 rounded-md text-sm font-medium
           hover:bg-secondary transition-colors
           focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
```

**Button rules:**
- `rounded-md` (8px) — not `rounded-full`. Professional, not playful.
- Maximum one primary button per page section.
- Destructive buttons must always appear inside a `ConfirmDialog`.
- Cancel is always `ghost` variant, left-aligned. Confirm is always right-aligned.
- "Execute Rebalance" is the ONLY primary button visible in Step 2 of the wizard.

---

## Data Tables (Holdings Table)

```tsx
/* Table container */
className="w-full border border-border rounded-lg overflow-hidden"

/* Header row */
className="bg-secondary text-muted-foreground text-xs font-mono
           uppercase tracking-wider"

/* Header cell */
className="px-4 py-3 text-left"

/* Data row (alternating: even rows bg-card, odd rows bg-secondary/30) */
className="border-t border-border hover:bg-secondary/50 transition-colors"

/* Numeric cell — ALWAYS right-aligned monospace */
className="px-4 py-3 text-right font-mono text-sm tabular-nums"

/* Text cell — left-aligned */
className="px-4 py-3 text-sm"

/* Drift cell */
className="px-4 py-3"
```

**Table rules:**
- Numeric columns: always `text-right font-mono tabular-nums`. Non-negotiable.
- Column widths: fixed (`w-24`, `w-32`) not `auto` — prevents layout shift.
- Mobile: `overflow-x-auto` on container, `sticky left-0 bg-card` on ticker column.
- Maximum 8 columns in default view.

---

## DriftBadge (Three-State)

```tsx
/* Green — within threshold */
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded
                 bg-positive-bg text-positive text-xs font-mono">
  <Circle className="w-2 h-2 fill-current" />
  {formatNumber(drift, 'drift')}
</span>

/* Amber — approaching threshold (within 2% of threshold value) */
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded
                 bg-warning-bg text-warning text-xs font-mono">
  <Triangle className="w-2 h-2 fill-current" />
  {formatNumber(drift, 'drift')}
</span>

/* Red — threshold exceeded */
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded
                 bg-negative-bg text-negative text-xs font-mono">
  <AlertCircle className="w-2 h-2 fill-current" />
  {formatNumber(drift, 'drift')}
</span>
```

**Drift badge rule:** Always show the sign. `+2.18%` = over target. `-1.44%` = under target. Tooltip explains the convention.

---

## Empty State

Every list/table must have an empty state. Every empty state has: minimal icon, one-line description, exactly one CTA.

```tsx
<div className="flex flex-col items-center justify-center py-16 gap-4">
  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
    <PlusCircle className="w-6 h-6 text-muted-foreground" />
  </div>
  <div className="text-center">
    <p className="text-sm font-medium">No holdings yet</p>
    <p className="text-xs text-muted-foreground mt-1">
      Add your first asset to start tracking this silo
    </p>
  </div>
  <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium
                     hover:bg-primary/90 transition-colors">
    Add asset
  </button>
</div>
```

---

## ErrorBanner

Appears at the top of the affected section (not as a modal). Shows error code, message, and retry button.

```tsx
<div className="bg-negative-bg border border-negative/30 rounded-lg p-4
                flex items-start justify-between gap-4">
  <div className="flex items-start gap-3">
    <AlertCircle className="w-5 h-5 text-negative mt-0.5 flex-shrink-0" />
    <div>
      <p className="text-sm font-medium text-negative">{error.message}</p>
      <p className="text-xs text-muted-foreground mt-1">Code: {error.code}</p>
    </div>
  </div>
  <button onClick={retry}
          className="text-xs text-primary hover:underline flex-shrink-0">
    Retry
  </button>
</div>
```

---

## ConfirmDialog (Non-Dismissible)

```tsx
<Dialog open={open}>
  {/* Intentionally no onOpenChange — non-dismissible */}
  <DialogContent className="max-w-md animate-in zoom-in-95 duration-200">
    <DialogHeader>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
    </DialogHeader>
    {/* Action-specific content */}
    <DialogFooter>
      <button variant="ghost" onClick={onCancel}>Cancel</button>
      <button variant="primary|destructive" onClick={onConfirm}>
        {confirmLabel}
      </button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Status Chips

```tsx
/* API platform — can sync */
<span className="text-[10px] font-mono px-2 py-0.5 rounded
                 bg-positive-bg text-positive uppercase tracking-wide">
  API
</span>

/* Manual platform */
<span className="text-[10px] font-mono px-2 py-0.5 rounded
                 bg-secondary text-muted-foreground uppercase tracking-wide">
  MANUAL
</span>

/* Execution mode — AUTO (Alpaca v1.0) */
<span className="text-[10px] font-mono px-2 py-0.5 rounded
                 bg-primary/10 text-primary uppercase tracking-wide">
  AUTO
</span>

/* Execution mode — MANUAL (all non-Alpaca in v1.0) */
<span className="text-[10px] font-mono px-2 py-0.5 rounded
                 bg-secondary text-muted-foreground uppercase tracking-wide">
  MANUAL
</span>

/* Alpaca LIVE badge — persistent amber warning */
<span className="text-[10px] font-mono px-2 py-0.5 rounded
                 bg-warning-bg text-warning uppercase tracking-wide font-semibold">
  LIVE
</span>
```

---

## LoadingSkeleton

Use `animate-pulse` on skeleton blocks matching the shape of the content they replace.

```tsx
/* Row skeleton (for table rows) */
<div className="animate-pulse flex gap-4 px-4 py-3 border-t border-border">
  <div className="h-4 bg-secondary rounded w-16" />
  <div className="h-4 bg-secondary rounded w-32" />
  <div className="h-4 bg-secondary rounded w-20 ml-auto" />
</div>

/* Card skeleton */
<div className="animate-pulse bg-card border border-border rounded-lg p-4 space-y-3">
  <div className="h-4 bg-secondary rounded w-3/4" />
  <div className="h-4 bg-secondary rounded w-1/2" />
  <div className="h-8 bg-secondary rounded w-full" />
</div>
```

---

## API Key Input

```tsx
<div className="relative">
  <input
    type={showKey ? "text" : "password"}
    placeholder="••••••••"
    autoComplete="off"
    autoCorrect="off"
    className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm
               focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none
               pr-10"
  />
  <button
    type="button"
    onClick={() => setShowKey(!showKey)}
    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground
               hover:text-foreground transition-colors"
    aria-label={showKey ? "Hide key" : "Show key"}
  >
    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
  </button>
</div>
```

---

## Numeric Input Fields (Financial Data)

All inputs that accept numbers in a financial context MUST use the following
attributes. This ensures mobile users get a numeric keyboard, not QWERTY.

```tsx
/* Weight percentage input (0–100, up to 3 decimal places) */
<input
  type="text"
  inputMode="decimal"
  pattern="[0-9]*\.?[0-9]*"
  placeholder="0.000"
  className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm
             text-right font-mono tabular-nums
             focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
/>

/* Cash amount input (monetary value) */
<input
  type="text"
  inputMode="decimal"
  pattern="[0-9]*\.?[0-9]*"
  placeholder="0.00"
  className="w-full border border-input bg-background px-3 py-2 rounded-md text-sm
             text-right font-mono tabular-nums
             focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
/>
```

**Rules:**
- NEVER use `type="number"` — it shows browser-native spinners (arrows) which are
  inappropriate for financial inputs and cause scroll-hijacking on mobile.
- ALWAYS use `type="text"` with `inputMode="decimal"` — this gives the decimal
  numeric keyboard on iOS/Android without the spinner.
- ALWAYS right-align numeric inputs: `text-right font-mono tabular-nums`.
- Validation runs on blur (when the user leaves the field) — NOT on every keystroke.
  Inline error while typing is irritating. Error after leaving the field is expected.

---

## Animations (Approved Only)

```tsx
/* Page transition */
className="animate-in fade-in duration-150"

/* Dialog in */
className="animate-in zoom-in-95 duration-200"

/* Toast notification */
className="animate-in slide-in-from-right duration-300"

/* Nav/card hover */
className="transition-colors duration-150"

/* Drift badge colour change */
className="transition-colors duration-300"
```

**Prohibited:** number count-up on data load, parallax scrolling, auto-playing looping animations, bounce/spring physics, fade-in of individual table rows.

**Reduced motion:** All animations must respect `prefers-reduced-motion`. Use `useReducedMotion()` hook. When reduced motion is preferred, set all durations to 0ms.
