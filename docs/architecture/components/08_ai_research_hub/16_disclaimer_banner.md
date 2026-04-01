# Sub-Component: Disclaimer Banner

## 1. The Goal

Display a persistent, non-collapsible, always-visible disclaimer on the Research page stating that the platform provides decision-support only and does not constitute financial advice. This satisfies CLAUDE.md Rule 14 (persistent disclaimer on all AI Research Hub outputs).

---

## 2. The Problem It Solves

AI-generated content carries legal and ethical risk if users could interpret it as professional financial advice. Without a prominent, persistent disclaimer, users may act on LLM-generated recommendations without understanding that no licensed advisor is behind the output.

---

## 3. The Proposed Solution / Underlying Concept

### Disclaimer Text

> "This platform provides data aggregation and decision-support only. Nothing on this page constitutes financial advice. Consult a licensed financial advisor before making investment decisions."

### Placement

The banner is rendered at the top of the Research page, above `LLMKeyGate` and all other content. It is part of the page layout, not a dismissible overlay.

### Non-Collapsible Rule

There is no close button, dismiss button, or `×` icon in the DOM. DevTools Elements inspection must confirm zero dismiss elements.

### Visual Design

- Background: `bg-muted/10` or `bg-card`
- Border: subtle `border border-muted`
- Text: `text-sm text-muted-foreground`
- Icon: Lucide `Info` or `AlertTriangle` inline before text
- Padding: `p-3` or `p-4`

### Implementation Rule

The `<DisclaimerBanner>` component renders the text with no `onOpenChange` prop and no close/dismiss handler. It must be impossible to hide via keyboard (Escape), click outside, or any gesture.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Banner visible on Research page | Manual: navigate to `/research/AAPL` → banner visible at top |
| Correct text shown | Visual: exact disclaimer text present |
| No dismiss/close button in DOM | DevTools Elements: search for `button`, `close`, `×` → none found |
| ESC key does not hide banner | Focus banner → press ESC → banner stays |
| `pnpm build` | Component compiles without errors |
