# Sub-Component: Narrative Summary Card

## 1. The Goal

Display the LLM's generated narrative summary as an expandable text block (150–300 words), with a collapsible sources list at the bottom. The summary is the primary qualitative output of the research pipeline.

---

## 2. The Problem It Solves

The narrative summary is the core qualitative output — a 150–300 word synthesis of the asset's fundamentals, recent news, and risk factors. It needs to be readable (expandable if long) with sources cited but not cluttering the initial view.

---

## 3. The Proposed Solution / Underlying Concept

### Summary Text

The card reads from the research session's structured output:
```typescript
{ summary: string, sources: Array<{ title: string, url: string, published_at: string }> }
```

### Expandable Behaviour

If the summary exceeds ~200 words, the card shows a "Show more" toggle that expands the full text. The toggle button reads "Show less" when expanded.

### Word Count Display

A subtle word count label reads: "~$N words" — shown in muted text below the summary.

### Sources List

At the bottom of the card, sources are listed in a collapsible section:
- Collapsed by default: "Sources (N) ▼"
- Expanded: numbered list of `{ title }` with `{ published_at }` as subtitle

### Source Item Format

```
1. [Article Title Here]
   Published: Mar 28, 2026
```

If a source has a URL, the title is a link (`target="_blank"`).

---

## 4. Testing & Verification

| What to Verify | How |
|---|---|
| Summary text renders | Visual: summary text visible in card |
| "Show more" appears for long summaries | Mock >200 word summary → toggle visible |
| Toggle expands/collapses | Click "Show more" → text expands; click "Show less" → collapses |
| Sources collapsible | Visual: "Sources (N)" section at bottom |
| Source links open in new tab | Click source link → new tab opens |
| `pnpm build` | Card compiles without errors |
