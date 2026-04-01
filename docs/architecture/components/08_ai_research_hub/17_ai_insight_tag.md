# Sub-Component: AI Insight Tag

## 1. The Goal

Show a brief (≤12 word) AI-generated insight tag on `PeerCard` components in the Discover page's peer grid. The tag reads from existing cached `research_sessions` data — it never triggers a new LLM call just to render the tag.

---

## 2. The Problem It Solves

When a user is exploring peer assets on the Discover page, seeing a brief AI-generated insight (e.g., "Tightly held, low volume") provides additional context that differentiates one peer from another. Without this, the peer grid shows only price data — leaving out the qualitative layer entirely.

---

## 3. The Proposed Solution / Underlying Concept

### Visibility Condition

`AiInsightTag` is rendered on a `PeerCard` only when ALL of the following are true:
1. `llm_connected === true` (LLM key is configured)
2. A `research_sessions` row exists for the peer ticker's ticker
3. The research session's `output.summary` has a cached value

If any condition is false, the tag is absent. No empty placeholder, skeleton, or loading indicator is shown.

### Tag Content

The tag reads the first ~12 words of `research_sessions.output.summary`:
```
"Bearish momentum, overvalued fundamentals"
```

### Maximum Length

If the extracted text exceeds 12 words, it is truncated to 12 with an ellipsis: "Bearish momentum, overvalued fundament..."

### Rendering

The tag is a small pill/badges:
- Background: `bg-primary/10`
- Text: `text-xs text-primary`
- Positioned: bottom-right of `PeerCard`
- Icon: small Lucide `Sparkles` before the text

### No New LLM Call

The tag reads exclusively from `GET /api/research/:peer_ticker` (which returns cached data). No `POST` is made. If no cache exists, the tag simply does not appear.

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Tag absent when no LLM key | `llm_connected = false` → PeerCard has no tag |
| Tag absent when no cached research | LLM key configured but no research for peer → tag absent |
| Tag present with cached research | LLM key + cached session → tag visible |
| Tag text ≤12 words | Visual: tag never exceeds 12 words |
| No new LLM call triggered | DevTools Network: loading peer grid → no POST to `/api/research/` |
| `pnpm build` | Component compiles without errors |
