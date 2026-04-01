# Sub-Component: Sentiment Card

## 1. The Goal

Display the LLM's overall sentiment verdict (bullish, neutral, or bearish) as a coloured badge with a text label, alongside a confidence score displayed as a labelled progress bar (0.0–1.0). Both colour and text must be present for accessibility.

---

## 2. The Problem It Solves

A user scanning research results needs to instantly gauge the LLM's overall take on an asset. Without a clear, scannable sentiment indicator, the user would have to read the full narrative summary to understand whether the asset is viewed positively or negatively.

---

## 3. The Proposed Solution / Underlying Concept

### Sentiment Badge

| Sentiment | Badge Colour | Text Label |
|---|---|---|
| Bullish | `bg-positive/10 text-positive border-positive` | "Bullish" + `TrendingUp` icon |
| Neutral | `bg-muted/10 text-muted border-muted` | "Neutral" + `Minus` icon |
| Bearish | `bg-negative/10 text-negative border-negative` | "Bearish" + `TrendingDown` icon |

The badge is rendered with `bg-{colour}/10` background, `text-{colour}` foreground, and a subtle border. The directional icon is always present alongside the text label.

### Confidence Bar

A labelled progress bar showing the confidence score (0.0 to 1.0):
- Label: "Confidence: 73%"
- Bar: filled proportion = confidence value
- Bar colour: matches sentiment colour

### Response Structure

The card reads from the research session's structured output:
```typescript
{ sentiment: 'bullish' | 'neutral' | 'bearish', confidence: number }
```

### Confidence Threshold

If `confidence < 0.5`, the card may show a note: "Low confidence — consider additional research." This is informational, not an error state.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Bullish badge has green bg + TrendingUp + "Bullish" label | Visual inspection |
| Neutral badge has muted bg + Minus + "Neutral" label | Visual inspection |
| Bearish badge has red bg + TrendingDown + "Bearish" label | Visual inspection |
| Confidence bar fills proportionally | confidence: 0.73 → bar is 73% filled |
| Low confidence note shown at <0.5 | Mock confidence: 0.4 → note visible |
| `pnpm build` | Card compiles without errors |
