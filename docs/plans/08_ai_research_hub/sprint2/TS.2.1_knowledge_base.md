# TS.2.1 — Default Knowledge Base

## Task
Create /knowledge directory with 10 curated Markdown files covering foundational finance topics.

## Target
`knowledge/`

## Inputs
- `docs/architecture/components/08_ai_research_hub/03_knowledge_base.md`

## Process
1. Create/verify 10+ curated Markdown files in `/knowledge/`:
   - `01-modern-portfolio-theory.md`
   - `02-asset-allocation-principles.md`
   - `03-rebalancing-strategies.md`
   - `04-systematic-risk-factors.md`
   - `05-dcf-analysis-fundamentals.md`
   - `06-fixed-income-basics.md`
   - `07-crypto-asset-characteristics.md`
   - `08-emerging-markets-risk.md`
   - `09-behavioral-finance-biases.md`
   - `10-portfolio-concentration-risk.md`
2. Each file: 1000-3000 words of factual, grounded finance content
3. These are ingested on first Research Hub use or via "Rebuild knowledge base" button
4. Source metadata: `{ source: "default", title, document_name }`

## Outputs
- 10+ files in `knowledge/` directory

## Verify
- All files present and well-formed Markdown
- Content is factual and grounded in established finance theory
- No allocation recommendations in content

## Handoff
→ TS.2.2 (RAG ingest pipeline)
