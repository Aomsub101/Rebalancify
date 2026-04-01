# Sub-Component: LLM Key Gate

## 1. The Goal

Block the entire Research Hub UI when no LLM API key is configured. The user must be clearly informed that they need to add a key in Settings before they can use the research feature. No research cards, ticker input, or any research UI renders behind this gate.

---

## 2. The Problem It Solves

If a user navigates to `/research/[ticker]` without an LLM key configured, the system would make a failing LLM call and surface an ugly error. Instead, a friendly gate explains exactly what the user needs to do (go to Settings, add a key) without attempting any LLM call.

---

## 3. The Proposed Solution / Underlying Concept

### Gate Logic

The gate reads `llm_connected` from `SessionContext` (or from a `GET /api/profile` call). If `llm_connected === false`, the gate UI is rendered. If `true`, the full research UI renders normally.

### Gate UI Content

The gate displays:
- A lock or key icon (Lucide `KeyRound` or similar)
- Heading: "LLM API Key Required"
- Body: "To use the Research Hub, add your LLM API key in Settings."
- CTA button: "Go to Settings" linking to `/settings`

### No Partial Rendering

The gate is not a banner or toast — it replaces the entire page content. There is no research UI visible behind it.

### Empty Placeholder Rule

When `llm_connected = true` but no cached research data exists for a ticker, the page does NOT show a blank state. It triggers the research pipeline and shows loading skeletons, eventually rendering the full results.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Gate shown when no key | `llm_connected = false` → gate renders, no research UI |
| Gate absent with key | `llm_connected = true` → gate does not render |
| CTA navigates to /settings | Click "Go to Settings" → router navigates to Settings |
| No LLM call attempted when gate is shown | DevTools Network: no call to `/api/research/:ticker` when gate is up |
| `pnpm build` | Component compiles without errors |
