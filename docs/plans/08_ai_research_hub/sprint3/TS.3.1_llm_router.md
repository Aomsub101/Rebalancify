# TS.3.1 — LLM Router

## Task
Implement lib/llmRouter.ts routing to 6 LLM providers via OpenAI SDK + Anthropic SDK.

## Target
`lib/llmRouter.ts`

## Inputs
- `docs/architecture/components/08_ai_research_hub/05_llm_router.md`

## Process
1. Create `lib/llmRouter.ts`:
   - **OpenAI-compatible providers** (use OpenAI SDK with base_url override):
     - Google AI Studio → `https://generativelanguage.googleapis.com/v1beta/openai/`
     - Groq → `https://api.groq.com/openai/v1`
     - DeepSeek → `https://api.deepseek.com`
     - OpenRouter → `https://openrouter.ai/api/v1`
     - OpenAI → default base_url
   - **Anthropic** (uses its own SDK):
     - `@anthropic-ai/sdk` with custom `anthropic-version` header
   - `routeLLMCall(provider, key, model, messages, options)`:
     - Decrypt key, instantiate correct client, make completion call
     - Return structured response
2. Structured output: request JSON schema in system prompt, parse response
3. Error handling: provider 500 → HTTP 502 `LLM_API_ERROR` with provider error message
4. No key in browser — all calls server-side via API routes

## Outputs
- `lib/llmRouter.ts`

## Verify
- All 6 providers routed correctly (unit tests with mocks)
- Anthropic uses its own SDK (not OpenAI SDK)
- Error responses include provider error message
- No API key in browser bundle

## Handoff
→ TS.3.2 (Research endpoint)
