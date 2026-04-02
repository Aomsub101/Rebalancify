# TS.5.1 — Unit Tests

## Task
Write unit tests for allocation guard, provider routing, and cache logic.

## Target
`tests/unit/`

## Process
1. `tests/unit/allocation-guard.test.ts`:
   - "Allocate 25% to AAPL" → unsafe
   - "P/E ratio is 25x" → safe (no false positive)
   - "Revenue grew 15%" → safe
   - "Consider buying 30% in tech" → unsafe
   - Edge: percentage at end of sentence, multiple percentages
2. `tests/unit/llm-router.test.ts`:
   - 6 provider routing tests (mock): correct base_url per provider
   - Anthropic uses own SDK (not OpenAI SDK)
   - Invalid provider → error
   - Provider 500 → LLM_API_ERROR with message
3. `tests/unit/research-cache.test.ts`:
   - Cache hit < 24h → return cached, no LLM call
   - Cache miss → LLM called
   - Forced refresh → new row, old untouched
4. `tests/unit/rag-pipeline.test.ts`:
   - Semantic chunking produces reasonable chunk sizes
   - Embedding dimension matches 1536

## Outputs
- `tests/unit/allocation-guard.test.ts`
- `tests/unit/llm-router.test.ts`
- `tests/unit/research-cache.test.ts`
- `tests/unit/rag-pipeline.test.ts`

## Verify
- `pnpm test` — all pass
