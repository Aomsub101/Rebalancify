# Sub-Component: Footer Disclaimer

## 1. The Goal

Display the "This is not financial advice" disclaimer in the footer of every page. This is a cross-cutting requirement (CLAUDE.md Rule 14) that applies to all pages — it is separate from the Research Hub's `DisclaimerBanner` (Component 8) which handles AI-specific content.

---

## 2. The Problem It Solves

Retail investors using a portfolio management tool need to understand that the platform is a decision-support tool, not a licensed financial advisor. This disclaimer must appear on every page to satisfy legal and ethical obligations, and to set correct user expectations.

---

## 3. The Proposed Solution / Underlying Concept

### Disclaimer Text

> "Rebalancify is not a licensed financial advisor. All content on this platform is for informational purposes only and does not constitute financial advice. Consult a licensed financial advisor before making investment decisions."

### Placement

`FooterDisclaimer` is included in the root layout (`app/layout.tsx`) or AppShell (`app/(dashboard)/layout.tsx`). It renders as a `<footer>` element or as a `<div>` at the bottom of the layout, below the main `{children}` content.

### Visual Design

- Background: transparent or `bg-muted/5`
- Text: `text-xs text-muted-foreground`
- Padding: `p-3` or `p-4`
- Border-top: subtle `border-t border-muted/10`
- Alignment: centered (`text-center`)

### Relationship to DisclaimerBanner

The page-level `FooterDisclaimer` handles Rule 14 (per-page requirement). On the Research page, the `DisclaimerBanner` (Component 8) provides the additional AI-specific disclaimer that is always visible above the research content. These are two separate, non-overlapping components.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Disclaimer in footer of every page | `grep -rn "not financial advice" app/` → at least one hit per page |
| Footer disclaimer present | Visual: footer visible on every page |
| Correct text | Visual: exact disclaimer text present |
| Not dismissible | Footer disclaimer is not a modal — always visible |
| `pnpm build` | Component compiles without errors |
