# docs/design/01-design-system.md — Design System (Token Reference)

## AGENT CONTEXT

**What this file is:** The authoritative colour token reference, typography scale, spacing scale, and layout grid. Agents should read this before implementing any UI component.
**Derived from:** design_preferences.md Sections 2, 3, 4
**Connected to:** docs/design/02-component-library.md (uses these tokens), docs/design/CLAUDE_FRONTEND.md (quick reference copy of key values), docs/design/05-theme-implementation.md (HSL values and exact CSS/Tailwind config implementation of these tokens)
**Critical rules for agents using this file:**
- Use CSS variable names (e.g., `var(--primary)`) in code — not hex values.
- In Tailwind classes, use semantic names (e.g., `text-foreground`, `bg-card`) — not hex-based arbitrary values.
- The sidebar is always dark. The CSS variable is `--sidebar-background`; the Tailwind class is `bg-sidebar`. Navy (#1E3A5F) in light mode, deeper dark (#111827) in dark mode.
- Action Blue (`#2E75B6`) is the ONLY interactive colour. It maps to `--primary` (shadcn convention: `--primary` = the main action colour). If it is blue, it is clickable or active.

---

## Colour Tokens — Complete Reference

```css
/* ─── LIGHT MODE ─── */
:root {
  /* Surfaces */
  --background:           #F8F9FA;
  --foreground:           #111827;
  --card:                 #FFFFFF;
  --card-foreground:      #111827;
  --popover:              #FFFFFF;
  --popover-foreground:   #111827;

  /* Brand */
  --primary:              #2E75B6;   /* Action Blue — shadcn primary = main interactive colour */
  --primary-foreground:   #FFFFFF;
  --secondary:            #EEF2F7;   /* Cool blue-grey surface */
  --secondary-foreground: #1E3A5F;

  /* Action */
  --accent:               #F1F5F9;   /* Ghost/outline hover surface (shadcn convention) */
  --accent-foreground:    #111827;
  --muted:                #F1F5F9;
  --muted-foreground:     #64748B;   /* Secondary text, labels */

  /* Semantic — Financial */
  --positive:             #1A6B3C;
  --positive-bg:          #D6F0E0;
  --warning:              #CC7000;
  --warning-bg:           #FFF0D6;
  --negative:             #A00000;
  --negative-bg:          #FAD7D7;

  /* UI Structure */
  --border:               #D1D9E6;
  --input:                #D1D9E6;
  --ring:                 #2E75B6;   /* Focus ring */
  --radius:               0.5rem;    /* 8px */

  /* Sidebar — ALWAYS dark, both modes (Tailwind class: bg-sidebar) */
  --sidebar-background:   #1E3A5F;
  --sidebar-foreground:   #E2E8F0;
  --sidebar-primary:      #2E75B6;   /* Active nav item */
  --sidebar-accent:       #2A4A72;   /* Hover state */
  --sidebar-border:       #2A4A72;
  --sidebar-ring:         #2E75B6;
}

/* ─── DARK MODE ─── */
.dark {
  --background:           #0F1117;
  --foreground:           #E2E8F0;
  --card:                 #1A1F2E;
  --card-foreground:      #E2E8F0;
  --popover:              #1A1F2E;
  --popover-foreground:   #E2E8F0;

  --primary:              #2E75B6;
  --primary-foreground:   #FFFFFF;
  --secondary:            #1E293B;
  --secondary-foreground: #E2E8F0;

  --accent:               #1E293B;   /* Ghost hover surface dark */
  --accent-foreground:    #E2E8F0;
  --muted:                #1E293B;
  --muted-foreground:     #94A3B8;

  /* Semantic — adjusted for dark legibility */
  --positive:             #22C55E;
  --positive-bg:          #14532D;
  --warning:              #F59E0B;
  --warning-bg:           #451A03;
  --negative:             #EF4444;
  --negative-bg:          #450A0A;

  --border:               #1E293B;
  --input:                #1E293B;
  --ring:                 #2E75B6;

  /* Sidebar — deeper dark in dark mode */
  --sidebar-background:   #111827;
  --sidebar-foreground:   #E2E8F0;
  --sidebar-primary:      #2E75B6;
  --sidebar-accent:       #1E293B;
  --sidebar-border:       #1E293B;
  --sidebar-ring:         #2E75B6;
}
```

---

## Colour Rules

1. **Never use colour as the only signal.** Every red/amber/green state must also have an icon or text label.
2. **Positive/negative does not mean good/bad.** A red drift badge means "threshold breached" — not "you are losing money."
3. **The sidebar is always dark** regardless of system colour mode.
4. **Action Blue (`#2E75B6`) is the only interactive colour.** Never use blue decoratively. In the CSS token system it maps to `--primary` (following shadcn/ui convention where `--primary` = main action colour).

> **shadcn/ui token convention note:** `--primary` = Action Blue (the clickable colour, used by the default button variant). `--accent` = ghost/outline hover surface (a subtle grey). The Navy brand colour (#1E3A5F) lives exclusively in `--sidebar-background` and related sidebar variables. This mapping is intentional and required for shadcn component variants to work correctly out of the box.

---

## Typography

**Font stack:**
```css
--font-sans: "Inter", "SF Pro Display", system-ui, sans-serif;
--font-mono: "JetBrains Mono", "Fira Code", "Courier New", monospace;
```

**Why Inter:** Designed for screen legibility at small sizes. At 13–14px (table data), Inter renders more crisply than DM Sans on Windows ClearType.
**Why JetBrains Mono:** Numerical data must use monospace. `฿1,247.50` and `฿12,847.50` must align at the decimal point.

**Type scale:**

| Class | Weight | Usage |
|---|---|---|
| `text-3xl font-semibold` | 600 | Page headings |
| `text-2xl font-semibold` | 600 | Section headings |
| `text-xl font-medium` | 500 | Card titles |
| `text-base font-normal` | 400 | Default UI copy |
| `text-sm font-normal` | 400 | Table text (non-numeric) |
| `text-xs font-normal` | 400 | Metadata, timestamps |
| `text-2xl font-mono font-semibold` | 600 | Hero stat numbers |
| `text-base font-mono font-medium` | 500 | Table numeric cells |
| `text-sm font-mono` | 400 | Secondary numeric data |
| `text-xs font-mono uppercase tracking-wider` | 400 | Section identifiers, status chips |

---

## Spacing Scale

| Value | Tailwind | Usage |
|---|---|---|
| 4px | `p-1`, `gap-1` | Icon padding, tight internal spacing |
| 8px | `p-2`, `gap-2` | Between label and input, badge elements |
| 12px | `p-3`, `gap-3` | Between table rows (compact) |
| 16px | `p-4`, `gap-4` | Card internal padding (default) |
| 24px | `p-6`, `gap-6` | Between cards in a grid |
| 32px | `p-8`, `gap-8` | Between major page sections |
| 48px | `py-12` | Section vertical padding |
| 64px | `py-16` | Page top/bottom padding |

---

## Layout Grid

| Context | Tailwind classes |
|---|---|
| Page container | `max-w-7xl mx-auto px-6` |
| Silo cards grid | `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6` |
| Holdings table | Full width, no max-width |
| News articles | `max-w-3xl mx-auto` |
| Peer cards grid | `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4` |
| Settings form | `max-w-2xl` |
| Modal — confirmation | `max-w-md` |
| Modal — complex (e.g., AssetSearchModal) | `max-w-2xl` |

---

## Layout Dimensions

| Element | Dimension |
|---|---|
| Sidebar (desktop) | 240px fixed width |
| Sidebar (collapsed rail) | 56px — icon only, on screens < 1024px |
| Top bar | 56px height |
| Mobile top bar | 48px height |
| Mobile bottom tab bar | 56px height |
| Border radius (standard) | 8px (`rounded-lg`) |
| Border radius (button) | 8px (`rounded-md`) |

---

## Number Formatting Rules

All implemented in `formatNumber()` utility — never formatted inline.

| Data type | Format | Example |
|---|---|---|
| Portfolio value (THB) | `฿1,247,500.00` | Always 2dp, thousands separator |
| Portfolio value (USD) | `$12,475.00` | Always 2dp |
| Weight percentage | `14.82%` | Always 2dp |
| Drift percentage | `+2.18%` or `-1.44%` | Always show sign |
| Quantity (stocks) | `10` or `10.5` | Whole numbers; max 4dp for fractional |
| Quantity (crypto) | `0.00245000` | Always 8dp |
| Price (stocks) | `$185.20` | Always 2dp |
| Price (crypto) | `฿1,547,000.00` | Always 2dp |
| Staleness | `14 min ago` or `3 days ago` | Relative time |
