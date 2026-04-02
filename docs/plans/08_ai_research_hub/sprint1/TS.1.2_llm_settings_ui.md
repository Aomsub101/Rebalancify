# TS.1.2 — LLM Settings UI

## Task
Build LLMSection in Settings page with provider selector, model selector, key input.

## Target
`app/(dashboard)/settings/page.tsx` (LLM section)

## Inputs
- TS.1.1 outputs (LLM key storage API)
- `docs/architecture/components/08_ai_research_hub/01_llm_settings_section.md`

## Process
1. Add LLMSection to Settings page:
   - **FreeTierNote:** "Gemini 2.0 Flash (Google AI Studio), Llama 3.3 70B (Groq), and DeepSeek V3 are free."
   - **ProviderSelector:** Dropdown with 6 providers, free tiers labelled "(Free)"
   - **ModelSelector:** Filtered by selected provider, pre-filled with recommended free model
   - **LLMKeyInput:** `type="password"` with show/hide toggle
   - **SaveButton:** PATCH /api/profile → validation ping → success/error feedback
2. Provider-model mapping:
   - Google → gemini-2.0-flash (Free)
   - Groq → llama-3.3-70b-versatile (Free)
   - DeepSeek → deepseek-chat (Free)
   - OpenAI → gpt-4o-mini
   - Anthropic → claude-3-5-haiku
   - OpenRouter → user-selected

## Outputs
- LLM section in `app/(dashboard)/settings/page.tsx`

## Verify
- Provider selector shows all 6 options with free labels
- Model selector updates on provider change
- Validation ping on save with success/error feedback

## Handoff
→ TS.1.3 (LLMKeyGate)
