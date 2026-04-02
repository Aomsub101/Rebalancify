# TS.4.3 — Disclaimer Banner & AiInsightTag

## Task
Build DisclaimerBanner (non-dismissible) and AiInsightTag for PeerCard enrichment.

## Target
`components/research/DisclaimerBanner.tsx`, `components/shared/AiInsightTag.tsx`

## Inputs
- `docs/architecture/components/08_ai_research_hub/16_disclaimer_banner.md`
- `docs/architecture/components/08_ai_research_hub/17_ai_insight_tag.md`

## Process
1. **DisclaimerBanner:**
   - Always visible on Research page, non-collapsible
   - Text: "This platform provides data aggregation and decision-support only. Nothing on this page constitutes financial advice. Consult a licensed financial advisor before making investment decisions."
   - No close/dismiss button in DOM (DevTools inspection: no button)
   - Placed above all research content
2. **AiInsightTag:**
   - Shown on PeerCard (Component 07 Discover page) when:
     - `llm_connected = true` AND
     - `research_sessions` row exists for the peer ticker
   - Brief ≤12 word insight extracted from cached research
   - No additional LLM call triggered — reads from existing cache
   - Hidden when `llm_connected = false` (no empty placeholder)
3. **FooterDisclaimer:** "This is not financial advice" in page footer (every page)

## Outputs
- `components/research/DisclaimerBanner.tsx`
- `components/shared/AiInsightTag.tsx`
- `components/shared/FooterDisclaimer.tsx`

## Verify
- DisclaimerBanner: no close button in DOM
- AiInsightTag: ≤12 words, no extra LLM calls
- AiInsightTag hidden when llm_connected = false
- FooterDisclaimer on every page

## Handoff
→ Sprint 5 (Testing)
