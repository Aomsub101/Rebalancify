# Component 08 — AI Research Hub: Implementation Plan

## Overview

v2.0 RAG-powered qualitative research layer: query any ticker for structured sentiment analysis with risk factors. Personal knowledge base (default + uploads), 6 LLM providers via AI Gateway, allocation guard rejecting percentage recommendations.

## Dependencies

- **Component 01:** Auth Foundation (middleware, Supabase clients)
- **Component 02:** Portfolio Data Layer (holdings ticker list, news context)
- **Component 03:** Rebalancing Engine (encryption utility for LLM key storage)
- **Component 05:** Market Data & Pricing (price context, Finnhub news)
- **Component 07:** Asset Discovery (AiInsightTag on PeerCard)

## Architecture Reference

- `docs/architecture/components/08_ai_research_hub/`

---

## Sprint 1 — LLM Key Storage & Settings

**Goal:** LLM key encryption, provider selection, Settings UI.

| Task | File | Summary |
|------|------|---------|
| TS.1.1 | `sprint1/TS.1.1_llm_key_storage.md` | PATCH /api/profile for LLM provider + key + model |
| TS.1.2 | `sprint1/TS.1.2_llm_settings_ui.md` | LLMSection in Settings (provider/model/key + validation) |
| TS.1.3 | `sprint1/TS.1.3_llm_key_gate.md` | LLMKeyGate component blocking Research UI without key |

---

## Sprint 2 — Knowledge Base & RAG Pipeline

**Goal:** Default knowledge base, ingest pipeline, user uploads, HNSW index.

| Task | File | Summary |
|------|------|---------|
| TS.2.1 | `sprint2/TS.2.1_knowledge_base.md` | /knowledge directory with 10 curated .md files |
| TS.2.2 | `sprint2/TS.2.2_rag_ingest_pipeline.md` | Semantic chunking → embed → upsert knowledge_chunks |
| TS.2.3 | `sprint2/TS.2.3_knowledge_upload.md` | POST /api/knowledge/upload (PDF/MD) + corpus size monitor |
| TS.2.4 | `sprint2/TS.2.4_knowledge_api.md` | POST /api/knowledge/ingest + GET corpus-size + DELETE docs |

---

## Sprint 3 — LLM Router & Research Endpoint

**Goal:** 6-provider routing, research pipeline, allocation guard.

| Task | File | Summary |
|------|------|---------|
| TS.3.1 | `sprint3/TS.3.1_llm_router.md` | lib/llmRouter.ts — 6 providers (OpenAI SDK + Anthropic SDK) |
| TS.3.2 | `sprint3/TS.3.2_research_endpoint.md` | POST /api/research/:ticker (cache → RAG → LLM → guard → store) |
| TS.3.3 | `sprint3/TS.3.3_allocation_guard.md` | Regex scan blocking allocation percentages in LLM output |

---

## Sprint 4 — Research Hub UI

**Goal:** Research page with sentiment, risk factors, narrative cards.

| Task | File | Summary |
|------|------|---------|
| TS.4.1 | `sprint4/TS.4.1_research_page.md` | /research/[ticker] page layout |
| TS.4.2 | `sprint4/TS.4.2_research_cards.md` | SentimentCard, RiskFactorsCard, NarrativeSummaryCard |
| TS.4.3 | `sprint4/TS.4.3_disclaimer_banner.md` | DisclaimerBanner (non-dismissible) + AiInsightTag |

---

## Sprint 5 — Testing

**Goal:** Comprehensive tests for all research hub components.

| Task | File | Summary |
|------|------|---------|
| TS.5.1 | `sprint5/TS.5.1_unit_tests.md` | Unit: allocation guard, provider routing, cache logic |
| TS.5.2 | `sprint5/TS.5.2_integration_tests.md` | Integration: RAG pipeline, research flow with mocks |
| TS.5.3 | `sprint5/TS.5.3_e2e_tests.md` | E2E: research page, LLMKeyGate, disclaimer |
