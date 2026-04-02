# TS.1.1 — LLM Key Storage

## Task
Extend PATCH /api/profile to encrypt and store LLM provider, key, and model selection.

## Target
`app/api/profile/route.ts` (extend)

## Inputs
- Component 03 encryption utility
- `docs/architecture/components/08_ai_research_hub/01_llm_settings_section.md`

## Process
1. Extend PATCH /api/profile to accept:
   - `llm_provider` → store directly (enum: 'google' | 'groq' | 'deepseek' | 'openai' | 'anthropic' | 'openrouter')
   - `llm_key` → encrypt → store as `llm_key_enc`
   - `llm_model` → store directly
2. Validation ping: on save, make a test call to the provider to verify key validity
   - Invalid key → return inline error, do not store
3. GET /api/profile returns: `llm_connected: boolean`, `llm_provider`, `llm_model` — never ciphertext
4. To disconnect: PATCH with `{ llm_key: null }` → set `llm_key_enc` to NULL

## Outputs
- Updated `app/api/profile/route.ts`

## Verify
- Save valid key → `llm_connected: true`
- Save invalid key → error returned, not stored
- GET never returns ciphertext

## Handoff
→ TS.1.2 (LLM settings UI)
