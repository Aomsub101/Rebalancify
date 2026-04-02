# TS.4.2 — Research Cards

## Task
Build SentimentCard, RiskFactorsCard, and NarrativeSummaryCard components.

## Target
`components/research/`

## Inputs
- `docs/architecture/components/08_ai_research_hub/13_sentiment_card.md`
- `docs/architecture/components/08_ai_research_hub/14_risk_factors_card.md`
- `docs/architecture/components/08_ai_research_hub/15_narrative_summary_card.md`

## Process
1. **SentimentCard:**
   - Coloured badge: bullish=green, neutral=muted, bearish=red
   - Confidence bar: 0.0-1.0 range (visual progress bar)
   - Both colour AND text label present (accessibility)
2. **RiskFactorsCard:**
   - Bulleted list of 2-8 risk factors
   - If LLM returns < 2 risk factors: show ErrorBanner
   - Each factor: concise one-line statement
3. **NarrativeSummaryCard:**
   - 150-300 word summary text
   - Expandable if truncated (show/hide toggle)
   - Sources list: collapsible section showing knowledge chunks + news used
4. All cards use formatNumber for any numeric values

## Outputs
- `components/research/SentimentCard.tsx`
- `components/research/RiskFactorsCard.tsx`
- `components/research/NarrativeSummaryCard.tsx`

## Verify
- Sentiment badge shows correct color + text
- Risk factors list between 2-8 items
- Summary expandable when > 300 words
- Sources collapsible

## Handoff
→ TS.4.3 (Disclaimer + AiInsightTag)
