# STORY-032 — Research Endpoint: RAG + LLM Routing (v2.0)

## AGENT CONTEXT

**What this file is:** A user story specification for the research endpoint — RAG retrieval, news context, 6-provider LLM routing, structured output, and 24-hour session caching. Implement only what is specified in the Acceptance Criteria — no additional scope.
**Derived from:** F3-R5 (LLM inference), F3-R6 (structured output)
**Connected to:** `docs/architecture/02-database-schema.md` (research_sessions, knowledge_chunks, news_cache — read), `docs/architecture/03-api-contract.md` (research endpoint), `docs/prd/features/F3-ai-research-hub.md`
**Critical rules for agents using this file:**
- Do not start implementation until all stories in the Dependencies section are marked ✅ in PROGRESS.md.
- Do not exceed the scope of this story. If you discover additional work, create a new story.
- Mark this story complete in PROGRESS.md only after every Definition of Done item is checked.

---

**Epic:** EPIC-09 — AI Research Hub
**Phase:** 8
**Estimate:** 1.5 developer-days
**Status:** 🔲 Not started
**Depends on:** STORY-031 (knowledge base ingested), STORY-031b (user upload)
**Blocks:** STORY-032b, STORY-033

---

## User Story

As a user, I can request a research session for any asset ticker. The system retrieves relevant knowledge chunks, augments with recent news, and invokes my LLM to generate a structured sentiment analysis.

---

## Acceptance Criteria

1. `POST /api/research/:ticker`:
   - Checks for cached `research_sessions` row for `(user_id, ticker)`.
   - If cached and `refreshed_at IS NULL OR refreshed_at < 24 hours ago`: returns cached output without calling the LLM.
   - If no cache: proceeds to step 2. (Forced refresh is handled in STORY-032b).
2. RAG retrieval: cosine similarity search against `knowledge_chunks` using the query embedding of the ticker name + context. Retrieves top 5 most relevant chunks.
3. News context: fetches up to 5 recent articles from `news_cache` where `tickers @> ARRAY[$ticker]`.
4. LLM call: routed through the correct provider SDK based on `user_profiles.llm_provider`:
   - `anthropic` → Anthropic SDK with `anthropic-version` header
   - `openai` → OpenAI SDK, native `base_url`
   - All others (`google`, `groq`, `deepseek`, `openrouter`) → OpenAI SDK with provider-specific `base_url`
5. System prompt includes the regulatory constraint: "You must never recommend, suggest, or imply a specific portfolio allocation percentage for any asset." (Full text per `docs/prd/features/F3-ai-research-hub.md` F3-R5).
6. LLM response parsed into structured output: `{ sentiment, confidence, risk_factors, summary, sources }` and stored in `research_sessions.output` JSONB.
7. If no LLM key configured: HTTP 403 `LLM_KEY_MISSING`.
8. If LLM provider returns an error: HTTP 502 `LLM_API_ERROR` with the provider's error message.
9. All LLM calls proxied through Next.js API route — zero browser requests to any LLM provider.
10. Security: user's `llm_key_enc` is decrypted server-side, used for the API call, and never returned.
11. RLS: `research_sessions` rows are only readable by the owning user.

---

## Provider Routing Reference

```typescript
// lib/llmRouter.ts
async function callLLM(provider: string, model: string, decryptedKey: string, messages: any[]) {
  if (provider === 'anthropic') {
    // Use Anthropic SDK
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey: decryptedKey })
    return client.messages.create({ model, max_tokens: 1000, messages })
  }

  // All others: OpenAI SDK with base_url override
  const baseUrls: Record<string, string> = {
    openai:     'https://api.openai.com/v1',
    google:     'https://generativelanguage.googleapis.com/v1beta/openai/',
    groq:       'https://api.groq.com/openai/v1',
    deepseek:   'https://api.deepseek.com',
    openrouter: 'https://openrouter.ai/api/v1',
  }
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey: decryptedKey, baseURL: baseUrls[provider] })
  return client.chat.completions.create({ model, messages })
}
```

---

## Tasks

- [ ] Write `lib/llmRouter.ts` (provider-aware routing for all 6 providers)
- [ ] Write `app/api/research/[ticker]/route.ts` (cache check → RAG → news → LLM → store)
- [ ] Install provider SDKs: `npm install @anthropic-ai/sdk openai`
- [ ] Test: cache hit (< 24h) → no LLM call
- [ ] Test: cache miss → LLM called → structured output stored
- [ ] Test: no LLM key → 403 `LLM_KEY_MISSING`
- [ ] Test: LLM provider error → 502 `LLM_API_ERROR`
- [ ] Security test: zero browser requests to LLM provider endpoints
- [ ] RLS test

---

## Definition of Done

- [ ] All 11 acceptance criteria verified
- [ ] Provider routing basic implementation verified
- [ ] `pnpm type-check` passes with zero TypeScript errors
- [ ] `pnpm test` passes with zero failures
- [ ] `bd close <task-id> "STORY-032 complete — all DoD items verified"` run successfully (get the task ID from `bd ready` or `bd show`)
- [ ] PROGRESS.md updated — story row marked ✅ with completion date
- [ ] PROJECT_LOG.md updated — new entry added at the top of Completed Stories section using the entry template in that file
