# Sub-Component: Risk Factors Card

## 1. The Goal

Display the LLM's extracted risk factors as a bulleted list. The card validates that the LLM returned at least 2 risk factors — a minimum threshold for a useful response. If fewer than 2 are returned, an `ErrorBanner` is shown instead of the list.

---

## 2. The Problem It Solves

LLM responses that return only 0 or 1 risk factor are not actionable. Without a minimum threshold enforced at the UI layer, a sparse LLM response would render as a near-empty card, potentially misleading the user into thinking the asset has few risks when in fact the model failed to generate sufficient content.

---

## 3. The Proposed Solution / Underlying Concept

### Card Content

The card reads from the research session's structured output:
```typescript
{ risk_factors: string[] }  // array of risk factor strings
```

### Rendering Rules

| Condition | Rendered |
|---|---|
| `risk_factors.length >= 2 && <= 8` | Bulleted list of risk factors |
| `risk_factors.length < 2` | `ErrorBanner` with message: "Insufficient risk factors returned — try refreshing." |
| `risk_factors.length > 8` | First 8 items only (truncated) |

### Bulleted List Design

Each item is rendered as a list item with:
- Bullet: small filled circle in `text-muted`
- Text: `text-sm text-foreground`
- Items are not numbered (bullets only)

### Error State — Refresh CTA

The `ErrorBanner` shown when <2 factors includes a retry button that re-runs the research call with `{ refresh: true }`.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| ≥2 risk factors → bulleted list renders | Mock response with 4 factors → list visible |
| <2 risk factors → ErrorBanner shown | Mock response with 1 factor → ErrorBanner, no empty list |
| ErrorBanner has retry button | ErrorBanner visible → retry button present and functional |
| Max 8 items rendered | Mock response with 12 factors → only first 8 shown |
| `pnpm build` | Card compiles without errors |
