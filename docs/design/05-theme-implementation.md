# docs/design/05-theme-implementation.md — Frontend Theme Implementation

## AGENT CONTEXT

**What this file is:** The source of truth for all theme-layer code: `app/globals.css` CSS variables, `tailwind.config.ts` additions, `app/layout.tsx` font loading, and `components.json` configuration. Read this before touching any of those files.
**Derived from:** `docs/design/01-design-system.md` (design intent); finalised via v0.app using the Rebalancify design system.
**Connected to:** `docs/design/01-design-system.md` (design intent and hex values), `docs/design/02-component-library.md` (Tailwind class patterns that depend on these tokens), `docs/development/00-project-structure.md` (file locations), `CLAUDE.md` Rule 2 (Tailwind only), Rule 6 (sidebar always dark)
**Critical rules for agents using this file:**
- This file wins all conflicts about what values go in `globals.css` and `tailwind.config.ts`.
- CSS variable values MUST remain in HSL space-separated format (e.g., `214 52% 25%`). Never convert to hex — Tailwind wraps them in `hsl()` and hex breaks the system silently.
- Never add a CSS variable without also adding its Tailwind mapping in `tailwind.config.ts`.
- Both `app/globals.css` and `styles/globals.css` must be kept identical at all times.

---

## Token Convention Decision Record

**`--primary` = Action Blue (#2E75B6).** Following shadcn/ui convention: the `default` Button variant uses `bg-primary`. Setting `--primary` to Action Blue means all shadcn/ui components work correctly without modification.

**`--accent` = ghost/outline hover surface (subtle grey).** In shadcn/ui, `--accent` is the hover background for `ghost` and `outline` button variants. It is not an interactive colour — it is a hover tint.

**Navy (#1E3A5F) lives exclusively in `--sidebar-background`.** It is no longer `--primary`. The sidebar Tailwind class is `bg-sidebar`, which resolves to `hsl(var(--sidebar-background))` via `tailwind.config.ts`.

> **Rationale:** If `--accent` were Action Blue, every `outline` and `ghost` button would flash solid blue on hover, making secondary controls visually aggressive. Correct mapping keeps the full shadcn component ecosystem working out of the box.

---

## app/globals.css — Complete File Contents

`styles/globals.css` must be a mirror of this file.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}

@layer base {
  :root {
    /* ── Fonts ── */
    --font-sans: var(--font-inter);
    --font-mono: var(--font-jetbrains-mono);

    /* ── Surfaces ── */
    --background: 210 17% 98%;
    --foreground: 221 39% 11%;
    --card: 0 0% 100%;
    --card-foreground: 221 39% 11%;
    --popover: 0 0% 100%;
    --popover-foreground: 221 39% 11%;

    /* ── Primary = Action Blue (shadcn: primary = main interactive colour) ── */
    --primary: 209 60% 45%;
    --primary-foreground: 0 0% 100%;

    /* ── Supporting surfaces ── */
    --secondary: 213 36% 95%;
    --secondary-foreground: 214 52% 25%;
    --muted: 213 27% 96%;
    --muted-foreground: 215 16% 47%;

    /* ── Accent = ghost/outline hover surface — NOT interactive ── */
    --accent: 213 27% 96%;
    --accent-foreground: 221 39% 11%;

    /* ── Destructive (maps to --negative visually) ── */
    --destructive: 0 100% 31%;
    --destructive-foreground: 0 0% 100%;

    /* ── Structure ── */
    --border: 213 30% 86%;
    --input: 213 30% 86%;
    --ring: 209 60% 45%;
    --radius: 0.5rem;

    /* ── Financial Semantic Tokens ── */
    --positive: 144 61% 26%;
    --positive-bg: 139 47% 89%;
    --warning: 33 100% 40%;
    --warning-bg: 37 100% 92%;
    --negative: 0 100% 31%;
    --negative-bg: 0 79% 91%;

    /* ── Chart Colours ── */
    --chart-1: 209 60% 45%;
    --chart-2: 144 61% 26%;
    --chart-3: 38 92% 50%;
    --chart-4: 0 100% 31%;
    --chart-5: 213 36% 60%;

    /* ── Sidebar — ALWAYS dark navy, both light and dark mode ── */
    --sidebar-background: 214 52% 25%;
    --sidebar-foreground: 213 32% 91%;
    --sidebar-primary: 209 60% 45%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 214 46% 31%;
    --sidebar-accent-foreground: 213 32% 91%;
    --sidebar-border: 214 46% 31%;
    --sidebar-ring: 209 60% 45%;
  }

  .dark {
    --background: 225 21% 7%;
    --foreground: 213 32% 91%;
    --card: 225 28% 14%;
    --card-foreground: 213 32% 91%;
    --popover: 225 28% 14%;
    --popover-foreground: 213 32% 91%;

    --primary: 209 60% 45%;
    --primary-foreground: 0 0% 100%;

    --secondary: 217 33% 17%;
    --secondary-foreground: 213 32% 91%;
    --muted: 217 33% 17%;
    --muted-foreground: 215 20% 65%;

    --accent: 217 33% 17%;
    --accent-foreground: 213 32% 91%;

    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;

    --border: 217 33% 17%;
    --input: 217 33% 17%;
    --ring: 209 60% 45%;

    --positive: 142 71% 45%;
    --positive-bg: 143 61% 20%;
    --warning: 38 92% 50%;
    --warning-bg: 21 92% 14%;
    --negative: 0 84% 60%;
    --negative-bg: 0 75% 15%;

    --chart-1: 209 60% 45%;
    --chart-2: 142 71% 45%;
    --chart-3: 38 92% 50%;
    --chart-4: 0 84% 60%;
    --chart-5: 213 36% 60%;

    /* ── Sidebar — deeper dark in dark mode ── */
    --sidebar-background: 221 39% 11%;
    --sidebar-foreground: 213 32% 91%;
    --sidebar-primary: 209 60% 45%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 217 33% 17%;
    --sidebar-accent-foreground: 213 32% 91%;
    --sidebar-border: 217 33% 17%;
    --sidebar-ring: 209 60% 45%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

---

## tailwind.config.ts — Required Additions

Add these inside `theme.extend`. Do NOT remove any existing keys.

**Inside `extend.colors`:**

```js
positive: {
  DEFAULT: "hsl(var(--positive))",
  bg: "hsl(var(--positive-bg))",
},
warning: {
  DEFAULT: "hsl(var(--warning))",
  bg: "hsl(var(--warning-bg))",
},
negative: {
  DEFAULT: "hsl(var(--negative))",
  bg: "hsl(var(--negative-bg))",
},
sidebar: {
  DEFAULT: "hsl(var(--sidebar-background))",
  foreground: "hsl(var(--sidebar-foreground))",
  primary: {
    DEFAULT: "hsl(var(--sidebar-primary))",
    foreground: "hsl(var(--sidebar-primary-foreground))",
  },
  accent: {
    DEFAULT: "hsl(var(--sidebar-accent))",
    foreground: "hsl(var(--sidebar-accent-foreground))",
  },
  border: "hsl(var(--sidebar-border))",
  ring: "hsl(var(--sidebar-ring))",
},
```

**New key alongside `colors` inside `extend`:**

```js
fontFamily: {
  sans: [
    "var(--font-inter)",
    "Inter",
    "SF Pro Display",
    "system-ui",
    "sans-serif",
  ],
  mono: [
    "var(--font-jetbrains-mono)",
    "JetBrains Mono",
    "Fira Code",
    "Courier New",
    "monospace",
  ],
},
```

**Tailwind utility classes available after this config:**

| Class | Resolves to |
|---|---|
| `bg-primary` | Action Blue `hsl(209 60% 45%)` |
| `bg-sidebar` | Dark navy `hsl(var(--sidebar-background))` (via `tailwind.config.ts`) |
| `bg-positive` / `bg-positive-bg` | Gain green / gain tint |
| `bg-warning` / `bg-warning-bg` | Amber / amber tint |
| `bg-negative` / `bg-negative-bg` | Loss red / loss tint |
| `font-sans` | Inter (via `--font-inter` CSS variable) |
| `font-mono` | JetBrains Mono (via `--font-jetbrains-mono` CSS variable) |

---

## app/layout.tsx — Font Loading Pattern

```tsx
import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
})

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}
```

**Why `${inter.variable} ${jetbrainsMono.variable}` on `<body>`:** Each `next/font` call creates a CSS variable on the element. `inter.variable` injects `--font-inter` and `jetbrainsMono.variable` injects `--font-jetbrains-mono`. The `--font-sans` and `--font-mono` variables in globals.css then point at these. This is Next.js's official font loading pattern.

---

## components.json — shadcn/ui Configuration

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

**`style: "new-york"`** — Do not change this after installation. Changing the style preset alters all existing component files.

---

## HSL ↔ Hex Reference Table

| Token | Light Hex (approx) | Light HSL | Dark Hex (approx) | Dark HSL |
|---|---|---|---|---|
| `--primary` | `#2E75B6` | `209 60% 45%` | `#2E75B6` | `209 60% 45%` |
| `--background` | `#F8F9FA` | `210 17% 98%` | `#0F1019` | `225 21% 7%` |
| `--card` | `#FFFFFF` | `0 0% 100%` | `#1B2033` | `225 28% 14%` |
| `--foreground` | `#111827` | `221 39% 11%` | `#E2E8F0` | `213 32% 91%` |
| `--sidebar-background` | `#1E3A5F` | `214 52% 25%` | `#111827` | `221 39% 11%` |
| `--positive` | `#1A6B3C` | `144 61% 26%` | `#22C55E` | `142 71% 45%` |
| `--warning` | `#CC7000` | `33 100% 40%` | `#F59E0B` | `38 92% 50%` |
| `--negative` | `#A00000` | `0 100% 31%` | `#EF4444` | `0 84% 60%` |
| `--destructive` | `#A00000` | `0 100% 31%` | `#EF4444` | `0 84% 60%` |

**Note:** Light `--background` resolves to `#F8F9FA` at `210 17% 98%`. This is the correct design-intent value.

---

## How to Add a New Token

1. Add the CSS variable in both `:root` and `.dark` in `app/globals.css` (HSL format).
2. Add its Tailwind mapping in `tailwind.config.ts` under `extend.colors`.
3. Mirror the change to `styles/globals.css`.
4. Add a row to the HSL ↔ Hex Reference table above.
5. If the token appears in component classNames, add it to `docs/design/02-component-library.md`.
