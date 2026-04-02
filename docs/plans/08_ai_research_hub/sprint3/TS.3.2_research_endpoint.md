# TS.3.2 — Research Endpoint

## Task
Implement POST /api/research/:ticker — the core RAG + LLM research pipeline.

## Target
`app/api/research/[ticker]/route.ts`

## Inputs
- Sprint 2 outputs (RAG pipeline, knowledge_chunks)
- TS.3.1 outputs (LLM router)
- `docs/architecture/components/08_ai_research_hub/07_api_research_ticker.md`

## Process
1. Create `app/api/research/[ticker]/route.ts`:
   - **Step 1 — Cache check:** If `research_sessions` row exists for (user_id, ticker) and refreshed_at < 24h ago → return cached output
   - **Step 2 — RAG retrieval:**
     - Generate query embedding from ticker + "financial analysis"
     - Cosine similarity search against knowledge_chunks (top 5)
     - Fetch up to 5 recent news articles from news_cache
   - **Step 3 — LLM inference:**
     - System prompt with regulatory constraint: never recommend allocation percentages
     - Augment with: top 5 knowledge chunks + up to 5 news articles
     - Structured output: `{ sentiment, confidence, risk_factors, summary, sources }`
   - **Step 4 — Allocation guard** (TS.3.3)
   - **Step 5 — Store & respond:**
     - Insert new `research_sessions` row with structured output
     - Return to client
2. **Forced refresh:** `{ refresh: true }` → new row with `refreshed_at` populated, old row untouched
3. **GET /api/research/:ticker** → read cached session (no LLM call)

## Outputs
- `app/api/research/[ticker]/route.ts` (POST + GET)

## Verify
- Cache hit < 24h → no LLM call
- RAG retrieval returns top 5 chunks (HNSW index used)
- Structured output matches expected schema
- Forced refresh creates new row

## Handoff
→ TS.3.3 (Allocation guard)
